import { supabase } from './supabase'
import type { Database } from './supabase'

type Category = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

type Session = Database['public']['Tables']['sessions']['Row']
type SessionInsert = Database['public']['Tables']['sessions']['Insert']
type SessionUpdate = Database['public']['Tables']['sessions']['Update']

type Goal = Database['public']['Tables']['goals']['Row']
type GoalInsert = Database['public']['Tables']['goals']['Insert']
type GoalUpdate = Database['public']['Tables']['goals']['Update']

type VisionPhoto = Database['public']['Tables']['vision_photos']['Row']
type VisionPhotoInsert = Database['public']['Tables']['vision_photos']['Insert']
type VisionPhotoUpdate = Database['public']['Tables']['vision_photos']['Update']

export class DataService {
  private userId: string | null = null
  private username: string | null = null

  constructor() {
    // Check localStorage for saved username
    if (typeof window !== 'undefined') {
      const savedUsername = localStorage.getItem('tracer_username')
      const savedUserId = localStorage.getItem('tracer_user_id')
      if (savedUsername && savedUserId) {
        this.username = savedUsername
        this.userId = savedUserId
      }
    }
  }

  // Simple username-based auth
  async signInWithUsername(username: string) {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (existingUser) {
      // User exists, log them in
      this.userId = existingUser.id
      this.username = existingUser.username
      if (typeof window !== 'undefined') {
        localStorage.setItem('tracer_username', this.username!)
        localStorage.setItem('tracer_user_id', this.userId!)
      }
      return { user: existingUser, error: null }
    }

    // User doesn't exist, create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ username, display_name: username })
      .select()
      .single()

    if (createError) {
      return { user: null, error: createError }
    }

    this.userId = newUser.id
    this.username = newUser.username
    if (typeof window !== 'undefined') {
      localStorage.setItem('tracer_username', this.username!)
      localStorage.setItem('tracer_user_id', this.userId!)
    }

    return { user: newUser, error: null }
  }

  async signOut() {
    this.userId = null
    this.username = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tracer_username')
      localStorage.removeItem('tracer_user_id')
    }
    return { error: null }
  }

  async getCurrentUser() {
    if (!this.userId || !this.username) {
      return { user: null, error: null }
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', this.userId)
      .single()

    return { user: data, error }
  }

  getUserId() {
    return this.userId
  }

  getUsername() {
    return this.username
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    if (!this.userId) return []
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }

    return data || []
  }

  async createCategory(category: Omit<CategoryInsert, 'user_id'>): Promise<Category | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('categories')
      .insert({ ...category, user_id: this.userId })
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      return null
    }

    return data
  }

  async updateCategory(id: string, updates: CategoryUpdate): Promise<Category | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
      return null
    }

    return data
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (!this.userId) return false

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error deleting category:', error)
      return false
    }

    return true
  }

  // Session methods
  async getSessions(): Promise<Session[]> {
    if (!this.userId) return []
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', this.userId)
      .order('start_time', { ascending: false })

    if (error) {
      console.error('Error fetching sessions:', error)
      return []
    }

    return data || []
  }

  async createSession(session: Omit<SessionInsert, 'user_id'>): Promise<Session | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('sessions')
      .insert({ ...session, user_id: this.userId })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return null
    }

    return data
  }

  async updateSession(id: string, updates: SessionUpdate): Promise<Session | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return null
    }

    return data
  }

  async deleteSession(id: string): Promise<boolean> {
    if (!this.userId) return false

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error deleting session:', error)
      return false
    }

    return true
  }

  // Goal methods
  async getGoals(): Promise<Goal[]> {
    if (!this.userId) return []
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goals:', error)
      return []
    }

    return data || []
  }

  async createGoal(goal: Omit<GoalInsert, 'user_id'>): Promise<Goal | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('goals')
      .insert({ ...goal, user_id: this.userId })
      .select()
      .single()

    if (error) {
      console.error('Error creating goal:', error)
      return null
    }

    return data
  }

  async updateGoal(id: string, updates: GoalUpdate): Promise<Goal | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating goal:', error)
      return null
    }

    return data
  }

  async deleteGoal(id: string): Promise<boolean> {
    if (!this.userId) return false

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error deleting goal:', error)
      return false
    }

    return true
  }

  // Vision Photo methods
  async getVisionPhotos(): Promise<VisionPhoto[]> {
    if (!this.userId) return []
    
    const { data, error } = await supabase
      .from('vision_photos')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching vision photos:', error)
      return []
    }

    return data || []
  }

  async createVisionPhoto(photo: Omit<VisionPhotoInsert, 'user_id'>): Promise<VisionPhoto | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('vision_photos')
      .insert({ ...photo, user_id: this.userId })
      .select()
      .single()

    if (error) {
      console.error('Error creating vision photo:', error)
      return null
    }

    return data
  }

  async updateVisionPhoto(id: string, updates: VisionPhotoUpdate): Promise<VisionPhoto | null> {
    if (!this.userId) return null

    const { data, error } = await supabase
      .from('vision_photos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating vision photo:', error)
      return null
    }

    return data
  }

  async deleteVisionPhoto(id: string): Promise<boolean> {
    if (!this.userId) return false

    const { error } = await supabase
      .from('vision_photos')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)

    if (error) {
      console.error('Error deleting vision photo:', error)
      return false
    }

    return true
  }

  // Real-time subscriptions
  subscribeToCategories(callback: (categories: Category[]) => void) {
    if (!this.userId) return () => {}

    return supabase
      .channel('categories')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'categories',
          filter: `user_id=eq.${this.userId}`
        }, 
        async () => {
          const categories = await this.getCategories()
          callback(categories)
        }
      )
      .subscribe()
  }

  subscribeToSessions(callback: (sessions: Session[]) => void) {
    if (!this.userId) return () => {}

    return supabase
      .channel('sessions')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions',
          filter: `user_id=eq.${this.userId}`
        }, 
        async () => {
          const sessions = await this.getSessions()
          callback(sessions)
        }
      )
      .subscribe()
  }

  subscribeToGoals(callback: (goals: Goal[]) => void) {
    if (!this.userId) return () => {}

    return supabase
      .channel('goals')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'goals',
          filter: `user_id=eq.${this.userId}`
        }, 
        async () => {
          const goals = await this.getGoals()
          callback(goals)
        }
      )
      .subscribe()
  }

  subscribeToVisionPhotos(callback: (photos: VisionPhoto[]) => void) {
    if (!this.userId) return () => {}

    return supabase
      .channel('vision_photos')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'vision_photos',
          filter: `user_id=eq.${this.userId}`
        }, 
        async () => {
          const photos = await this.getVisionPhotos()
          callback(photos)
        }
      )
      .subscribe()
  }
}

export const dataService = new DataService()
