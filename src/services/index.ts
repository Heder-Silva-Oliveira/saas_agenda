import { DATA_MODE } from '../config'
import { demoApi } from './demo'
import { supabaseApi } from './supabase'
import type { Api } from './types'

export const api: Api = DATA_MODE === 'supabase' ? supabaseApi : demoApi

export type { Api }
