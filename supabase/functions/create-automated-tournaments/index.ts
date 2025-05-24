import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current date
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 7)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Create daily tournament if none exists for today
    const { data: existingDaily } = await supabaseClient
      .from('tournaments')
      .select('id')
      .eq('is_automated', true)
      .gte('start_date', startOfDay.toISOString())
      .lt('end_date', endOfDay.toISOString())
      .single()

    if (!existingDaily) {
      // Get random trick for daily tournament
      const { data: randomTrick } = await supabaseClient
        .from('tricks')
        .select('id')
        .eq('category', 'flat')
        .limit(1)
        .order('RANDOM()')
        .single()

      if (randomTrick) {
        // Get daily tournament type
        const { data: dailyType } = await supabaseClient
          .from('tournament_types')
          .select('id')
          .eq('frequency', 'daily')
          .single()

        if (dailyType) {
          await supabaseClient.from('tournaments').insert({
            tournament_type_id: dailyType.id,
            trick_id: randomTrick.id,
            start_date: startOfDay.toISOString(),
            end_date: endOfDay.toISOString(),
            status: 'active',
            is_automated: true
          })
        }
      }
    }

    // Create weekly tournaments if none exist for this week
    const { data: existingWeekly } = await supabaseClient
      .from('tournaments')
      .select('tournament_types(category)')
      .eq('is_automated', true)
      .gte('start_date', startOfWeek.toISOString())
      .lt('end_date', endOfWeek.toISOString())

    const existingCategories = new Set(existingWeekly?.map(t => t.tournament_types.category) || [])

    // Get weekly tournament types
    const { data: weeklyTypes } = await supabaseClient
      .from('tournament_types')
      .select('id, category')
      .eq('frequency', 'weekly')

    if (weeklyTypes) {
      for (const type of weeklyTypes) {
        if (!existingCategories.has(type.category)) {
          await supabaseClient.from('tournaments').insert({
            tournament_type_id: type.id,
            start_date: startOfWeek.toISOString(),
            end_date: endOfWeek.toISOString(),
            status: 'active',
            is_automated: true
          })
        }
      }
    }

    // Create monthly tournament if none exists for this month
    const { data: existingMonthly } = await supabaseClient
      .from('tournaments')
      .select('id')
      .eq('is_automated', true)
      .gte('start_date', startOfMonth.toISOString())
      .lt('end_date', endOfMonth.toISOString())
      .single()

    if (!existingMonthly) {
      // Get monthly tournament type
      const { data: monthlyType } = await supabaseClient
        .from('tournament_types')
        .select('id')
        .eq('frequency', 'monthly')
        .single()

      if (monthlyType) {
        await supabaseClient.from('tournaments').insert({
          tournament_type_id: monthlyType.id,
          start_date: startOfMonth.toISOString(),
          end_date: endOfMonth.toISOString(),
          status: 'active',
          is_automated: true
        })
      }
    }

    // Update tournament statuses
    await supabaseClient.rpc('update_tournament_statuses')

    return new Response(
      JSON.stringify({ message: 'Tournaments updated successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 