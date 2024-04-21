import { ChainId } from '@pancakeswap/chains'
import { WETH9 } from '@pancakeswap/sdk'
import { CAKE, USDC, USDT } from './common'

export const openExLongTestnetTokens = {
  cake: CAKE[ChainId.OPEN_EX_LONG_TEST],
  weth: WETH9[ChainId.OPEN_EX_LONG_TEST],
  usdc: USDC[ChainId.OPEN_EX_LONG_TEST],
  oex: USDT[ChainId.OPEN_EX_LONG_TEST],
}
