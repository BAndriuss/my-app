-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS profiles;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')) NOT NULL,
  type TEXT CHECK (type IN ('board', 'wheels', 'trucks', 'bearings', 'griptape', 'hardware', 'tools', 'accessories', 'clothing', 'other')) NOT NULL,
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  main_image_url TEXT NOT NULL,
  sold BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create an index for faster username lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);

-- Create policies for items table
CREATE POLICY "Items are viewable by everyone"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can update items to buy them"
  ON items FOR UPDATE
  USING (NOT sold)
  WITH CHECK (
    auth.uid() IS NOT NULL AND  -- Must be logged in
    auth.uid() != user_id AND   -- Can't buy own items
    buyer_id = auth.uid() AND   -- Must set themselves as buyer
    sold = true                 -- Must mark as sold
  );

-- Drop existing purchase function if exists
DROP FUNCTION IF EXISTS purchase_item(UUID, UUID, DECIMAL);

-- Create purchase_item function for atomic transactions
CREATE OR REPLACE FUNCTION purchase_item(
  p_item_id UUID,
  p_buyer_id UUID,
  p_amount DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seller_id UUID;
  v_item_exists BOOLEAN;
  v_sufficient_funds BOOLEAN;
BEGIN
  -- Check if item exists and is not sold
  SELECT EXISTS (
    SELECT 1 FROM items i
    WHERE i.id = p_item_id 
    AND NOT i.sold 
    AND i.user_id != p_buyer_id
  ) INTO v_item_exists;
  
  IF NOT v_item_exists THEN
    RAISE EXCEPTION 'Item does not exist, is already sold, or you are the owner';
  END IF;

  -- Get seller ID
  SELECT i.user_id INTO v_seller_id
  FROM items i
  WHERE i.id = p_item_id;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Seller not found';
  END IF;

  -- Check if buyer has sufficient funds
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_buyer_id
    AND p.balance >= p_amount
  ) INTO v_sufficient_funds;

  IF NOT v_sufficient_funds THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Perform the transaction
  -- 1. Deduct from buyer
  UPDATE profiles p
  SET balance = p.balance - p_amount
  WHERE p.id = p_buyer_id;

  -- 2. Add to seller
  UPDATE profiles p
  SET balance = p.balance + p_amount
  WHERE p.id = v_seller_id;

  -- 3. Mark item as sold
  UPDATE items i
  SET sold = true,
      buyer_id = p_buyer_id
  WHERE i.id = p_item_id;

  RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in purchase_item: %', SQLERRM;
  RAISE;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, balance)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)  -- Fallback to email prefix if no username
    ),
    0.00
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 