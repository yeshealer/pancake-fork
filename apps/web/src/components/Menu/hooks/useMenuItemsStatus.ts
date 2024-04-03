import { useUserCakeLockStatus } from 'hooks/useUserCakeLockStatus'
import { useMemo } from 'react'
import { useCompetitionStatus } from './useCompetitionStatus'
import { useIfoStatus } from './useIfoStatus'

export const useMenuItemsStatus = (): Record<string, string> => {
  const ifoStatus = useIfoStatus()
  const competitionStatus = useCompetitionStatus()
  const isUserLocked = useUserCakeLockStatus()

  return useMemo(() => {
    return {
      '/competition': competitionStatus || '',
      '/ifo': ifoStatus || '',
      ...(isUserLocked && {
        '/pools': 'lock_end',
      }),
    }
  }, [competitionStatus, ifoStatus, isUserLocked])
}
