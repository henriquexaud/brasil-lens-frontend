import { useEffect } from 'react';
import type { FollowedMunicipality } from '@/api/types';
import { useFollowedMunicipalities } from '@/features/follow/useFollowedMunicipalities';

export function useNotificationNavigation(onOpen: (item: FollowedMunicipality) => void) {
  const followed = useFollowedMunicipalities();
  useEffect(() => {
    if (!followed.data) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('municipality');
    if (!code) return;
    url.searchParams.delete('municipality');
    window.history.replaceState(null, '', url);
    const item = followed.data.municipalities.find((city) => city.municipalityCode === code);
    if (item) onOpen(item);
  }, [followed.data, onOpen]);
}
