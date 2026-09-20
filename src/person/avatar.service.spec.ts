import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AvatarSource } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AvatarService } from './avatar.service';

describe('AvatarService', () => {
  let service: AvatarService;
  let prisma: { person: { findUnique: jest.Mock; update: jest.Mock } };
  let storage: { upload: jest.Mock; delete: jest.Mock };

  const defaultPerson = {
    id: 'person-1',
    avatar: 'https://api.example.com/assets/default-avatar.svg',
    avatarSource: AvatarSource.DEFAULT,
    avatarStorageKey: null,
  };

  beforeEach(async () => {
    prisma = {
      person: {
        findUnique: jest.fn().mockResolvedValue(defaultPerson),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...defaultPerson, ...data })),
      },
    };
    storage = {
      upload: jest.fn().mockResolvedValue({
        url: 'https://api.example.com/uploads/avatars/t1/x.png',
        key: 'avatars/t1/x.png',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AvatarService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = moduleRef.get(AvatarService);
  });

  it('findOne throws NotFound when the tenant has no Person row', async () => {
    prisma.person.findUnique.mockResolvedValue(null);
    await expect(service.findOne('t1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne returns the current avatar url and source', async () => {
    await expect(service.findOne('t1')).resolves.toEqual({
      url: defaultPerson.avatar,
      source: AvatarSource.DEFAULT,
    });
  });

  it('rejects an unsupported content type (e.g. SVG)', async () => {
    await expect(
      service.upload('t1', {
        buffer: Buffer.from(''),
        mimetype: 'image/svg+xml',
        originalname: 'evil.svg',
        size: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a file whose extension does not match its content type', async () => {
    await expect(
      service.upload('t1', {
        buffer: Buffer.from(''),
        mimetype: 'image/png',
        originalname: 'photo.jpg',
        size: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('accepts a valid image, stores it, and marks the avatar CUSTOM', async () => {
    const result = await service.upload('t1', {
      buffer: Buffer.from('fake-bytes'),
      mimetype: 'image/png',
      originalname: 'photo.png',
      size: 1024,
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'avatars/t1', originalName: 'photo.png' }),
    );
    expect(prisma.person.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ avatarSource: AvatarSource.CUSTOM }),
      }),
    );
    expect(result.source).toBe(AvatarSource.CUSTOM);
  });

  it('uploads the replacement before deleting the previous custom file', async () => {
    prisma.person.findUnique.mockResolvedValue({
      ...defaultPerson,
      avatarSource: AvatarSource.CUSTOM,
      avatarStorageKey: 'avatars/t1/old.png',
    });

    const callOrder: string[] = [];
    storage.upload.mockImplementation(async () => {
      callOrder.push('upload');
      return {
        url: 'https://api.example.com/uploads/avatars/t1/new.png',
        key: 'avatars/t1/new.png',
      };
    });
    storage.delete.mockImplementation(async () => {
      callOrder.push('delete');
    });

    await service.upload('t1', {
      buffer: Buffer.from('fake-bytes'),
      mimetype: 'image/png',
      originalname: 'photo.png',
      size: 1024,
    });

    expect(callOrder).toEqual(['upload', 'delete']);
    expect(storage.delete).toHaveBeenCalledWith('avatars/t1/old.png');
  });

  it('does not attempt to delete anything when replacing a DEFAULT avatar', async () => {
    await service.upload('t1', {
      buffer: Buffer.from('fake-bytes'),
      mimetype: 'image/png',
      originalname: 'photo.png',
      size: 1024,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('remove() falls back to the default avatar and clears the storage key', async () => {
    prisma.person.findUnique.mockResolvedValue({
      ...defaultPerson,
      avatarSource: AvatarSource.CUSTOM,
      avatarStorageKey: 'avatars/t1/old.png',
    });

    const result = await service.remove('t1');

    expect(storage.delete).toHaveBeenCalledWith('avatars/t1/old.png');
    expect(result.source).toBe(AvatarSource.DEFAULT);
    expect(result.url).toContain('default-avatar.svg');
  });

  it('remove() on an already-DEFAULT avatar never leaves avatar empty and does not call storage.delete', async () => {
    const result = await service.remove('t1');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(result.url).toContain('default-avatar.svg');
    expect(result.source).toBe(AvatarSource.DEFAULT);
  });
});
