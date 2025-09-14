import { ProfileRepository } from '../repositories/profile.repository.js'
import type { ProfileDTO, UpdateProfilePayload } from '../domain/profile.model'

export class ProfileService {
    static async get(userId: number): Promise<ProfileDTO | null> {
        return ProfileRepository.getByUserId(userId)
    }

    static async update(userId: number, payload: UpdateProfilePayload): Promise<ProfileDTO> {
        return ProfileRepository.update(userId, payload)
    }

    static async updateAvatar(userId: number, value: string): Promise<ProfileDTO> {
        return ProfileRepository.updateAvatar(userId, value)
    }
}
