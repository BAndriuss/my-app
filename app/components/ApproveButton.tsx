'use client'

import { useState } from 'react'
import styles from './ApproveButton.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'

interface ApproveButtonProps {
  onApprove: () => Promise<void>
  itemName?: string
}

export default function ApproveButton({ onApprove, itemName = 'spot' }: ApproveButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleClick = async () => {
    if (isSuccess || isApproving) return;

    if (!isConfirming) {
      setIsConfirming(true)
      setTimeout(() => {
        if (!isApproving) {
          setIsConfirming(false)
        }
      }, 3000)
      return
    }

    try {
      setIsApproving(true)
      await onApprove()
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        setIsApproving(false)
        setIsConfirming(false)
      }, 3000)
    } catch (error) {
      console.error('Error approving:', error)
      setIsApproving(false)
      setIsConfirming(false)
    }
  }

  const buttonClasses = [
    styles.approveBtn,
    isConfirming ? styles.confirming : '',
    isApproving ? styles.approving : '',
    isSuccess ? styles.success : ''
  ].filter(Boolean).join(' ')

  return (
    <button
      onClick={handleClick}
      className={buttonClasses}
      disabled={isApproving}
    >
      <span className={styles.text}>
        {isSuccess ? 'APPROVED!' : (isConfirming ? 'ARE YOU SURE?' : `APPROVE ${itemName}`)}
      </span>
      <div className={styles.icon}>
        <FontAwesomeIcon 
          icon={faCheck}
          className={styles.fa}
        />
      </div>
    </button>
  )
} 