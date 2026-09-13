import React from 'react';
import { Composition } from 'remotion';
import { RetainingWallPromo } from './PromoVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RetainingWallPromo"
        component={RetainingWallPromo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
