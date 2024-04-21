import { openExLongTestnetTokens } from '@pancakeswap/tokens'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { FarmConfigV3 } from '../src'
import { defineFarmV3Configs } from '../src/defineFarmV3Configs'

const v3TopFixedLps: FarmConfigV3[] = [
  {
    pid: 1,
    lpAddress: '0x1ac1A8FEaAEa1900C4166dEeed0C11cC10669D36',
    token0: openExLongTestnetTokens.usdc,
    token1: openExLongTestnetTokens.weth,
    feeAmount: FeeAmount.LOW,
  },
  {
    pid: 2,
    lpAddress: '0xb36634b9c1a171019839da471b65a8c331f76f15',
    token0: openExLongTestnetTokens.weth,
    token1: openExLongTestnetTokens.cake,
    feeAmount: FeeAmount.LOW,
  },
  {
    pid: 3,
    lpAddress: '0x04c8577958CcC170EB3d2CCa76F9d51bc6E42D8f',
    token0: openExLongTestnetTokens.usdc,
    token1: openExLongTestnetTokens.cake,
    feeAmount: FeeAmount.LOWEST,
  },
]

export const farmsV3 = defineFarmV3Configs([...v3TopFixedLps])
