import { describe, expect, it } from 'vitest';
import { publicAsset } from '../publicAsset';

describe('publicAsset', () => {
  it('returns a document-relative public URL for static file:// exports', () => {
    const logoUrl = publicAsset('sflogo.svg');

    expect(logoUrl).toBe('./sflogo.svg');
    expect(new URL(logoUrl, 'file:///app/out/index.html').href).toBe('file:///app/out/sflogo.svg');
    expect(publicAsset('textures/ground/diff.jpg')).toBe('./textures/ground/diff.jpg');
  });

  it('keeps the same public path working from the root Next dev page', () => {
    expect(new URL(publicAsset('sflogo.svg'), 'http://localhost:3000/').href).toBe(
      'http://localhost:3000/sflogo.svg',
    );
  });

  it('normalizes a leading slash without producing a root-absolute URL', () => {
    expect(publicAsset('/sflogo.svg')).toBe('./sflogo.svg');
  });
});
