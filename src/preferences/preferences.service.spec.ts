import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  let prisma: { userPreference: { findUnique: jest.Mock; upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      userPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create, update }) => ({
          userId: create.userId,
          themeMode: update.themeMode,
        })),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PreferencesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PreferencesService);
  });

  describe('findOne', () => {
    it('defaults to light when no row exists', async () => {
      await expect(service.findOne('u1')).resolves.toEqual({ themeMode: 'light' });
    });

    it('returns the stored value once a row exists', async () => {
      prisma.userPreference.findUnique.mockResolvedValue({ themeMode: 'dark' });
      await expect(service.findOne('u1')).resolves.toEqual({ themeMode: 'dark' });
    });
  });

  describe('update', () => {
    it('rejects an unknown theme mode', async () => {
      await expect(service.update('u1', 'blue')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userPreference.upsert).not.toHaveBeenCalled();
    });

    it('upserts keyed strictly by the passed userId', async () => {
      await service.update('u1', 'dark');
      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: { userId: 'u1', themeMode: 'dark' },
        update: { themeMode: 'dark' },
      });
    });

    it('returns the persisted value', async () => {
      await expect(service.update('u1', 'dark')).resolves.toEqual({ themeMode: 'dark' });
    });
  });
});
