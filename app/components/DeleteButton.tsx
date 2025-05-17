'use client'

import { useState } from 'react'
import styles from './DeleteButton.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faCheck } from '@fortawesome/free-solid-svg-icons'

interface DeleteButtonProps {
  onDelete: () => Promise<void>
  itemName?: string
}

export default function DeleteButton({ onDelete, itemName = 'spot' }: DeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleClick = async () => {
    if (isSuccess || isDeleting) return;

    if (!isConfirming) {
      setIsConfirming(true)
      setTimeout(() => {
        if (!isDeleting) {
          setIsConfirming(false)
        }
      }, 3000)
      return
    }

    try {
      setIsDeleting(true)
      await onDelete()
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        setIsDeleting(false)
        setIsConfirming(false)
      }, 3000)
    } catch (error) {
      console.error('Error deleting:', error)
      setIsDeleting(false)
      setIsConfirming(false)
    }
  }

  const buttonClasses = [
    styles.deleteBtn,
    isConfirming ? styles.confirming : '',
    isDeleting ? styles.deleting : '',
    isSuccess ? styles.success : ''
  ].filter(Boolean).join(' ')

  return (
    <button
      onClick={handleClick}
      className={buttonClasses}
      disabled={isDeleting}
    >
      <span className={styles.text}>
        {isSuccess ? 'DELETED!' : (isConfirming ? 'ARE YOU SURE?' : `DELETE ${itemName}`)}
      </span>
      <div className={styles.icon}>
        <FontAwesomeIcon 
          icon={isSuccess ? faCheck : faTimes} 
          className={styles.fa}
        />
      </div>
    </button>
  )
} 