import type {
  AccessRequestInput,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Business,
  BusinessInput,
  Client,
  ClientImportRow,
  ClientInput,
  DashboardData,
  ImportResult,
  MessageLog,
  MessageTemplate,
  Professional,
  ProfessionalInput,
  PublicAppointment,
  PublicBookingInput,
  PublicBookingResult,
  PublicBusinessInfo,
  PublicSlot,
  Service,
  ServiceInput,
  SessionUser,
  SignUpInput,
  SignUpResult,
  TemplateCategory,
} from '../types'
import type { DataMode } from '../config'

export interface AuthService {
  getSession(): Promise<SessionUser | null>
  signIn(email: string, password: string): Promise<SessionUser>
  signUp(input: SignUpInput): Promise<SignUpResult>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

export interface BusinessService {
  get(): Promise<Business>
  update(input: BusinessInput): Promise<Business>
  requestAccess(input: AccessRequestInput): Promise<void>
  uploadLogo(file: File): Promise<string>
}

export interface ClientsService {
  list(): Promise<Client[]>
  get(id: string): Promise<Client | null>
  create(input: ClientInput): Promise<Client>
  update(id: string, input: ClientInput): Promise<Client>
  softDelete(id: string): Promise<void>
  importMany(rows: ClientImportRow[]): Promise<ImportResult>
  checkDuplicatePhone(phone: string, ignoreId?: string): Promise<Client | null>
}

export interface ServicesService {
  list(): Promise<Service[]>
  create(input: ServiceInput): Promise<Service>
  update(id: string, input: ServiceInput): Promise<Service>
  deactivate(id: string): Promise<void>
}

export interface ProfessionalsService {
  list(): Promise<Professional[]>
  create(input: ProfessionalInput): Promise<Professional>
  update(id: string, input: ProfessionalInput): Promise<Professional>
  deactivate(id: string): Promise<void>
}

export interface PublicBookingService {
  getBusiness(slug: string): Promise<PublicBusinessInfo | null>
  getSlots(input: {
    slug: string
    serviceId: string
    professionalId?: string | null
    date: string
  }): Promise<PublicSlot[]>
  create(input: PublicBookingInput): Promise<PublicBookingResult>
  getAppointment(id: string, token: string): Promise<PublicAppointment | null>
  cancel(id: string, token: string): Promise<void>
}

export interface AppointmentsService {
  list(): Promise<Appointment[]>
  get(id: string): Promise<Appointment | null>
  create(input: AppointmentInput): Promise<Appointment>
  update(id: string, input: AppointmentInput): Promise<Appointment>
  setStatus(id: string, status: AppointmentStatus): Promise<void>
  remove(id: string): Promise<void>
}

export interface TemplatesService {
  list(): Promise<MessageTemplate[]>
  update(
    id: string,
    input: { name?: string; body?: string; active?: boolean },
  ): Promise<MessageTemplate>
  findByCategory(category: TemplateCategory): Promise<MessageTemplate | null>
}

export interface LogsService {
  list(): Promise<MessageLog[]>
  listByClient(clientId: string): Promise<MessageLog[]>
  create(input: {
    clientId: string
    appointmentId?: string | null
    templateId?: string | null
    messageContent: string
    status?: MessageLog['status']
  }): Promise<MessageLog>
}

export interface DashboardService {
  get(): Promise<DashboardData>
}

export interface Api {
  mode: DataMode
  auth: AuthService
  business: BusinessService
  clients: ClientsService
  services: ServicesService
  professionals: ProfessionalsService
  appointments: AppointmentsService
  templates: TemplatesService
  logs: LogsService
  dashboard: DashboardService
  publicBooking: PublicBookingService
}
