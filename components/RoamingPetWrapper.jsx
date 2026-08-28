'use client';

import dynamic from 'next/dynamic';

const RoamingPet = dynamic(() => import('./RoamingPet'), { ssr: false });

export default function RoamingPetWrapper() {
  return <RoamingPet />;
}
