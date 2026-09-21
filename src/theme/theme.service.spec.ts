import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let prisma: { tenantTheme: { findUnique: jest.Mock; update: jest.Mock } };

  const existingTheme = {
    primaryColor: '#6366f1',
    secondaryColor: '#64748b',
    accentColor: '#06b6d4',
    backgroundColor: '#ffffff',
    textColor: '#334155',
    headingColor: '#0f172a',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.5rem',
    layout: 'classic',
    designSystem: 'modern',
    themeMode: 'light',
    customCss: null,
  };

  beforeEach(async () => {
    prisma = {
      tenantTheme: {
        findUnique: jest.fn().mockResolvedValue(existingTheme),
        update: jest.fn().mockImplementation(({ data }) => ({ ...existingTheme, ...data })),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ThemeService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ThemeService);
  });

  describe('findOne', () => {
    it('throws NotFoundException when no theme row exists for the tenant', async () => {
      prisma.tenantTheme.findUnique.mockResolvedValue(null);
      await expect(service.findOne('t1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows a valid design system + layout pair sent together', async () => {
      const result = await service.update('t1', { designSystem: 'creative', layout: 'sidebar' });
      expect(result.designSystem).toBe('creative');
      expect(result.layout).toBe('sidebar');
    });

    it('allows changing only the color fields, leaving design system/layout untouched', async () => {
      await service.update('t1', { primaryColor: '#123456' });
      expect(prisma.tenantTheme.update).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        data: { primaryColor: '#123456' },
      });
    });

    it('rejects an unknown design system', async () => {
      await expect(service.update('t1', { designSystem: 'nope' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an unknown layout', async () => {
      await expect(service.update('t1', { layout: 'nope' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects creative + classic sent together', async () => {
      await expect(
        service.update('t1', { designSystem: 'creative', layout: 'classic' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects switching to creative while classic is already the stored layout', async () => {
      // existingTheme.layout is 'classic' - switching designSystem alone must still be checked
      // against it, not just against whatever the caller happened to also send.
      await expect(service.update('t1', { designSystem: 'creative' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects switching to classic while creative is already the stored design system', async () => {
      prisma.tenantTheme.findUnique.mockResolvedValue({
        ...existingTheme,
        designSystem: 'creative',
        layout: 'sidebar',
      });
      await expect(service.update('t1', { layout: 'classic' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not re-validate compatibility when neither field is being changed', async () => {
      // Even if the stored pair were somehow invalid, a PATCH touching unrelated fields
      // must not be blocked by it.
      prisma.tenantTheme.findUnique.mockResolvedValue({
        ...existingTheme,
        designSystem: 'creative',
        layout: 'classic',
      });
      await expect(service.update('t1', { primaryColor: '#000000' })).resolves.toBeDefined();
    });

    it('allows a valid theme mode change', async () => {
      const result = await service.update('t1', { themeMode: 'dark' });
      expect(result.themeMode).toBe('dark');
    });

    it('rejects an unknown theme mode', async () => {
      await expect(service.update('t1', { themeMode: 'blue' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
