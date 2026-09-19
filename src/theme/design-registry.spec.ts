import {
  DESIGN_SYSTEMS,
  LAYOUTS,
  isCompatible,
  isValidDesignSystem,
  isValidLayout,
} from './design-registry';

describe('design-registry', () => {
  it('has at least the two initial design systems and layouts', () => {
    expect(DESIGN_SYSTEMS.map((d) => d.id)).toEqual(expect.arrayContaining(['modern', 'creative']));
    expect(LAYOUTS.map((l) => l.id)).toEqual(expect.arrayContaining(['classic', 'sidebar']));
  });

  describe('isValidDesignSystem', () => {
    it('accepts every registered design system', () => {
      for (const d of DESIGN_SYSTEMS) {
        expect(isValidDesignSystem(d.id)).toBe(true);
      }
    });

    it('rejects an unknown id', () => {
      expect(isValidDesignSystem('not-a-real-design-system')).toBe(false);
    });
  });

  describe('isValidLayout', () => {
    it('accepts every registered layout', () => {
      for (const l of LAYOUTS) {
        expect(isValidLayout(l.id)).toBe(true);
      }
    });

    it('rejects an unknown id', () => {
      expect(isValidLayout('not-a-real-layout')).toBe(false);
    });
  });

  describe('isCompatible', () => {
    it('modern supports both classic and sidebar', () => {
      expect(isCompatible('modern', 'classic')).toBe(true);
      expect(isCompatible('modern', 'sidebar')).toBe(true);
    });

    it('creative supports only sidebar', () => {
      expect(isCompatible('creative', 'sidebar')).toBe(true);
      expect(isCompatible('creative', 'classic')).toBe(false);
    });

    it('is false for an unknown design system regardless of layout', () => {
      expect(isCompatible('not-a-real-design-system', 'classic')).toBe(false);
    });
  });
});
