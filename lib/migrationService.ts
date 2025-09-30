import { dataService } from './dataService'

// Migration utility to convert localStorage data to Supabase format
export class MigrationService {
  // Convert old Category format to new Supabase format
  static convertCategory(oldCategory: any) {
    return {
      name: oldCategory.name,
      color: oldCategory.color,
      goal_pct: oldCategory.goalPct || null,
      icon: oldCategory.icon || null,
      parent_id: oldCategory.parentId || null
    }
  }

  // Convert old Session format to new Supabase format
  static convertSession(oldSession: any) {
    return {
      category_id: oldSession.categoryId,
      start_time: new Date(oldSession.start).toISOString(),
      end_time: oldSession.end ? new Date(oldSession.end).toISOString() : null,
      duration_seconds: oldSession.end ? Math.round((oldSession.end - oldSession.start) / 1000) : null
    }
  }

  // Convert old Goal format to new Supabase format
  static convertGoal(oldGoal: any) {
    return {
      category_id: oldGoal.categoryId,
      text: oldGoal.text,
      completed: oldGoal.completed || false
    }
  }

  // Convert old VisionPhoto format to new Supabase format
  static convertVisionPhoto(oldPhoto: any) {
    return {
      src: oldPhoto.src,
      alt: oldPhoto.alt
    }
  }

  // Migrate all data from localStorage to Supabase
  static async migrateFromLocalStorage() {
    try {
      const storageKey = "time-tracker-mvp-v11"
      const raw = localStorage.getItem(storageKey)
      
      if (!raw) {
        console.log('No localStorage data found to migrate')
        return { success: true, message: 'No data to migrate' }
      }

      const data = JSON.parse(raw)
      const results = {
        categories: 0,
        sessions: 0,
        goals: 0,
        visionPhotos: 0,
        errors: [] as string[]
      }

      // Migrate categories
      if (data.categories && Array.isArray(data.categories)) {
        for (const category of data.categories) {
          try {
            const converted = this.convertCategory(category)
            const created = await dataService.createCategory(converted)
            if (created) results.categories++
          } catch (error) {
            results.errors.push(`Category ${category.name}: ${error}`)
          }
        }
      }

      // Migrate sessions
      if (data.sessions && Array.isArray(data.sessions)) {
        for (const session of data.sessions) {
          try {
            const converted = this.convertSession(session)
            const created = await dataService.createSession(converted)
            if (created) results.sessions++
          } catch (error) {
            results.errors.push(`Session ${session.id}: ${error}`)
          }
        }
      }

      // Migrate goals
      if (data.goals && Array.isArray(data.goals)) {
        for (const goal of data.goals) {
          try {
            const converted = this.convertGoal(goal)
            const created = await dataService.createGoal(converted)
            if (created) results.goals++
          } catch (error) {
            results.errors.push(`Goal ${goal.id}: ${error}`)
          }
        }
      }

      // Migrate vision photos
      if (data.visionPhotos && Array.isArray(data.visionPhotos)) {
        for (const photo of data.visionPhotos) {
          try {
            const converted = this.convertVisionPhoto(photo)
            const created = await dataService.createVisionPhoto(converted)
            if (created) results.visionPhotos++
          } catch (error) {
            results.errors.push(`Vision photo ${photo.id}: ${error}`)
          }
        }
      }

      // Clear localStorage after successful migration
      if (results.errors.length === 0) {
        localStorage.removeItem(storageKey)
        localStorage.removeItem("time-tracker-prefs-v2")
      }

      return {
        success: results.errors.length === 0,
        message: `Migrated ${results.categories} categories, ${results.sessions} sessions, ${results.goals} goals, ${results.visionPhotos} vision photos`,
        errors: results.errors
      }

    } catch (error) {
      return {
        success: false,
        message: `Migration failed: ${error}`,
        errors: [String(error)]
      }
    }
  }

  // Check if user has data in Supabase
  static async hasSupabaseData(): Promise<boolean> {
    try {
      const categories = await dataService.getCategories()
      return categories.length > 0
    } catch {
      return false
    }
  }

  // Check if user has localStorage data
  static hasLocalStorageData(): boolean {
    const storageKey = "time-tracker-mvp-v11"
    return localStorage.getItem(storageKey) !== null
  }
}
