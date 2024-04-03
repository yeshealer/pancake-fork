import { ChainId } from '@pancakeswap/chains'
import { HelpIcon } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import Image from 'next/image'
import { memo } from 'react'
import { isChainSupported } from 'utils/wagmi'

export const ChainLogo = memo(
  ({ chainId, width = 24, height = 24 }: { chainId?: number; width?: number; height?: number }) => {
    if (chainId && isChainSupported(chainId)) {
      return (
        <Image
          alt={`chain-${chainId}`}
          style={{ maxHeight: `${height}px`, borderRadius: '50%' }}
          src={`${ASSET_CDN}/web/chains/${chainId}.png`}
          onError={({ currentTarget }) => {
            currentTarget.onerror = null
            currentTarget.src =
              chainId === ChainId.OPEN_EX_LONG_TEST
                ? 'https://ipfs.io/ipfs/bafkreidnu6p6vmmplerzvkboq7fz73ygkomzpnnokuxstrqv2fvxgmgg7i'
                : '/images/no_icon.png'
          }}
          width={width}
          height={height}
          unoptimized
        />
      )
    }

    return <HelpIcon width={width} height={height} />
  },
)
