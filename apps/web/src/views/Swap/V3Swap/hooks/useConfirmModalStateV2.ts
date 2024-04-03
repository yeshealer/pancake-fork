import { usePreviousValue } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { BSC_BLOCK_TIME } from '@pancakeswap/pools'
import { SmartRouterTrade } from '@pancakeswap/smart-router'
import { Currency, CurrencyAmount, Percent, Token, TradeType } from '@pancakeswap/swap-sdk-core'
import { Permit2Signature } from '@pancakeswap/universal-router-sdk'
import { ConfirmModalState, confirmPriceImpactWithoutFee } from '@pancakeswap/widgets-internal'
import { AVERAGE_CHAIN_BLOCK_TIMES } from 'config/constants/averageChainBlockTimes'
import { ALLOWED_PRICE_IMPACT_HIGH, PRICE_IMPACT_WITHOUT_FEE_CONFIRM_MIN } from 'config/constants/exchange'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { usePermit2 } from 'hooks/usePermit2'
import { usePermit2Requires } from 'hooks/usePermit2Requires'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { wait } from 'state/multicall/retry'
import { publicClient } from 'utils/client'
import { UserUnexpectedTxError } from 'utils/errors'
import { Address, Hex } from 'viem'
import { mainnet } from 'wagmi'
import { computeTradePriceBreakdown } from '../utils/exchange'
import { userRejectedError } from './useSendSwapTransaction'
import { useSwapCallbackV2 } from './useSwapCallbackV2'

export type ConfirmAction = {
  step: ConfirmModalState
  action: (nextStep?: ConfirmModalState) => Promise<void>
  showIndicator: boolean
}

const useCreateConfirmSteps = (amountToApprove: CurrencyAmount<Token> | undefined, spender: Address | undefined) => {
  const { requireApprove, requirePermit, requireRevoke } = usePermit2Requires(amountToApprove, spender)

  return useCallback(() => {
    const steps: ConfirmModalState[] = []
    if (requireRevoke) {
      steps.push(ConfirmModalState.RESETTING_APPROVAL)
    }
    if (requireApprove) {
      steps.push(ConfirmModalState.APPROVING_TOKEN)
    }
    if (requirePermit) {
      steps.push(ConfirmModalState.PERMITTING)
    }
    steps.push(ConfirmModalState.PENDING_CONFIRMATION)
    return steps
  }, [requireRevoke, requireApprove, requirePermit])
}

// define the actions of each step
const useConfirmActions = (
  trade: SmartRouterTrade<TradeType> | undefined,
  amountToApprove: CurrencyAmount<Token> | undefined,
  spender: Address | undefined,
) => {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const [deadline] = useTransactionDeadline()
  const { revoke, permit, approve, refetch } = usePermit2(amountToApprove, spender)
  const [permit2Signature, setPermit2Signature] = useState<Permit2Signature | undefined>(undefined)
  const { callback: swap, error: swapError } = useSwapCallbackV2({
    trade,
    deadline,
    permitSignature: permit2Signature,
  })
  const [confirmState, setConfirmState] = useState<ConfirmModalState>(ConfirmModalState.REVIEWING)
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

  const resetState = useCallback(() => {
    setConfirmState(ConfirmModalState.REVIEWING)
    setTxHash(undefined)
    setErrorMessage(undefined)
    setPermit2Signature(undefined)
  }, [])

  const showError = useCallback((error: string) => {
    setErrorMessage(error)
    setTxHash(undefined)
    setPermit2Signature(undefined)
  }, [])

  // define the action of each step
  const revokeStep = useMemo(() => {
    const action = async (nextState?: ConfirmModalState) => {
      setTxHash(undefined)
      setConfirmState(ConfirmModalState.RESETTING_APPROVAL)
      try {
        const result = await revoke()
        if (result?.hash && chainId) {
          setTxHash(result.hash)
          // sync to same with updater /apps/web/src/state/transactions/updater.tsx#L101
          await wait((AVERAGE_CHAIN_BLOCK_TIMES[chainId] ?? BSC_BLOCK_TIME) * 1000 + 2000)
          await publicClient({ chainId }).waitForTransactionReceipt({ hash: result.hash })
        }

        let newAllowanceRaw: bigint = 0n

        try {
          // check if user really reset the approval to 0
          const { data } = await refetch()
          newAllowanceRaw = data ?? 0n
        } catch (error) {
          // assume the approval reset is successful, if we can't check the allowance
          console.error('check allowance after revoke failed: ', error)
        }

        const newAllowance = CurrencyAmount.fromRawAmount(amountToApprove?.currency as Currency, newAllowanceRaw ?? 0n)
        if (!newAllowance.equalTo(0)) {
          throw new UserUnexpectedTxError({
            expectedData: 0,
            actualData: newAllowanceRaw.toString(),
          })
        }

        setConfirmState(nextState ?? ConfirmModalState.APPROVING_TOKEN)
      } catch (error) {
        console.error('revoke error', error)
        if (userRejectedError(error)) {
          showError(t('Transaction rejected'))
        } else if (error instanceof UserUnexpectedTxError) {
          showError(t('Revert transaction filled, but Approval not reset to 0. Please try again.'))
        } else {
          showError(typeof error === 'string' ? error : (error as any)?.message)
        }
      }
    }
    return {
      step: ConfirmModalState.RESETTING_APPROVAL,
      action,
      showIndicator: true,
    }
  }, [amountToApprove?.currency, chainId, refetch, revoke, showError, t])

  const permitStep = useMemo(() => {
    return {
      step: ConfirmModalState.PERMITTING,
      action: async (nextState?: ConfirmModalState) => {
        setConfirmState(ConfirmModalState.PERMITTING)
        try {
          const result = await permit()
          setPermit2Signature(result)
          setConfirmState(nextState ?? ConfirmModalState.PENDING_CONFIRMATION)
        } catch (error) {
          if (userRejectedError(error)) {
            showError('Transaction rejected')
          } else {
            showError(typeof error === 'string' ? error : (error as any)?.message)
          }
        }
      },
      showIndicator: true,
    }
  }, [permit, showError])

  const approveStep = useMemo(() => {
    return {
      step: ConfirmModalState.APPROVING_TOKEN,
      action: async (nextState?: ConfirmModalState) => {
        setTxHash(undefined)
        setConfirmState(ConfirmModalState.APPROVING_TOKEN)
        try {
          const result = await approve()
          if (result?.hash && chainId) {
            setTxHash(result.hash)
            await publicClient({ chainId }).waitForTransactionReceipt({
              hash: result.hash,
              confirmations: chainId === mainnet.id ? 2 : 1,
            })
          }
          let newAllowanceRaw: bigint = amountToApprove?.quotient ?? 0n
          // check if user really approved the amount trade needs
          try {
            const { data } = await refetch()
            newAllowanceRaw = data ?? 0n
          } catch (error) {
            // assume the approval is successful, if we can't check the allowance
            console.error('check allowance after approve failed: ', error)
          }
          const newAllowance = CurrencyAmount.fromRawAmount(
            amountToApprove?.currency as Currency,
            newAllowanceRaw ?? 0n,
          )
          if (amountToApprove && newAllowance && newAllowance.lessThan(amountToApprove)) {
            throw new UserUnexpectedTxError({
              expectedData: amountToApprove.toExact(),
              actualData: newAllowanceRaw.toString(),
            })
          }

          setConfirmState(nextState ?? ConfirmModalState.PERMITTING)
        } catch (error) {
          console.error('approve error', error)
          if (userRejectedError(error)) {
            showError(t('Transaction rejected'))
          } else if (error instanceof UserUnexpectedTxError) {
            showError(
              t('Approve transaction filled, but Approval still not enough to fill current trade. Please try again.'),
            )
          } else {
            showError(typeof error === 'string' ? error : (error as any)?.message)
          }
        }
      },
      showIndicator: true,
    }
  }, [amountToApprove, approve, chainId, refetch, showError, t])

  const tradePriceBreakdown = useMemo(() => computeTradePriceBreakdown(trade), [trade])
  const swapPreflightCheck = useCallback(() => {
    if (
      tradePriceBreakdown &&
      !confirmPriceImpactWithoutFee(
        tradePriceBreakdown.priceImpactWithoutFee as Percent,
        PRICE_IMPACT_WITHOUT_FEE_CONFIRM_MIN,
        ALLOWED_PRICE_IMPACT_HIGH,
        t,
      )
    ) {
      return false
    }
    return true
  }, [t, tradePriceBreakdown])

  const swapStep = useMemo(() => {
    return {
      step: ConfirmModalState.PENDING_CONFIRMATION,
      action: async () => {
        setTxHash(undefined)
        setConfirmState(ConfirmModalState.PENDING_CONFIRMATION)

        if (!swap || !swapPreflightCheck()) {
          resetState()
          return
        }

        if (swapError) {
          showError(swapError)
          return
        }

        try {
          const result = await swap()
          if (result?.hash) {
            setTxHash(result.hash)

            await publicClient({ chainId }).waitForTransactionReceipt({
              hash: result.hash,
              confirmations: chainId === mainnet.id ? 2 : 1,
            })
          }
          setConfirmState(ConfirmModalState.COMPLETED)
        } catch (error: any) {
          console.error('swap error', error)
          if (userRejectedError(error)) {
            showError('Transaction rejected')
          } else {
            showError(typeof error === 'string' ? error : (error as any)?.message)
          }
        }
      },
      showIndicator: false,
    }
  }, [chainId, resetState, showError, swap, swapError, swapPreflightCheck])

  const actions = useMemo(() => {
    return {
      [ConfirmModalState.RESETTING_APPROVAL]: revokeStep,
      [ConfirmModalState.PERMITTING]: permitStep,
      [ConfirmModalState.APPROVING_TOKEN]: approveStep,
      [ConfirmModalState.PENDING_CONFIRMATION]: swapStep,
    } as { [k in ConfirmModalState]: ConfirmAction }
  }, [approveStep, permitStep, revokeStep, swapStep])

  return {
    txHash,
    actions,

    confirmState,
    resetState,
    errorMessage,
  }
}

export const useConfirmModalStateV2 = (
  trade: SmartRouterTrade<TradeType> | undefined,
  amountToApprove: CurrencyAmount<Token> | undefined,
  spender: Address | undefined,
) => {
  const { actions, confirmState, txHash, errorMessage, resetState } = useConfirmActions(trade, amountToApprove, spender)
  const preConfirmState = usePreviousValue(confirmState)
  const [confirmSteps, setConfirmSteps] = useState<ConfirmModalState[]>()

  const createSteps = useCreateConfirmSteps(amountToApprove, spender)
  const confirmActions = useMemo(() => {
    return confirmSteps?.map((step) => actions[step])
  }, [confirmSteps, actions])

  const performStep = useCallback(
    async ({
      nextStep,
      stepActions,
      state,
    }: {
      nextStep?: ConfirmModalState
      stepActions: ConfirmAction[]
      state: ConfirmModalState
    }) => {
      if (!stepActions) {
        return
      }

      const step = stepActions.find((s) => s.step === state) ?? stepActions[0]

      await step.action(nextStep)
    },
    [],
  )

  const callToAction = useCallback(() => {
    const steps = createSteps()
    setConfirmSteps(steps)
    const stepActions = steps.map((step) => actions[step])
    const nextStep = steps[1] ?? undefined

    performStep({
      nextStep,
      stepActions,
      state: steps[0],
    })
  }, [actions, createSteps, performStep])

  // auto perform the next step
  useEffect(() => {
    if (
      preConfirmState !== confirmState &&
      preConfirmState !== ConfirmModalState.REVIEWING &&
      confirmActions?.some((step) => step.step === confirmState)
    ) {
      const nextStep = confirmActions.findIndex((step) => step.step === confirmState)
      const nextStepState = confirmActions[nextStep + 1]?.step ?? ConfirmModalState.PENDING_CONFIRMATION
      performStep({ nextStep: nextStepState, stepActions: confirmActions, state: confirmState })
    }
  }, [confirmActions, confirmState, performStep, preConfirmState])

  return {
    callToAction,
    errorMessage,
    confirmState,
    resetState,
    txHash,
    confirmActions,
  }
}
