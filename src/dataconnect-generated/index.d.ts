import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AgendaEntry_Key {
  id: UUIDString;
  __typename?: 'AgendaEntry_Key';
}

export interface CreateAgendaEntryData {
  agendaEntry_insert: AgendaEntry_Key;
}

export interface CreateAgendaEntryVariables {
  dailyScheduleId: UUIDString;
  time: number;
  description: string;
  isCompleted: boolean;
  positionInHour: number;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  displayName: string;
  email?: string | null;
  photoUrl?: string | null;
}

export interface DailySchedule_Key {
  id: UUIDString;
  __typename?: 'DailySchedule_Key';
}

export interface GetDailyScheduleData {
  dailySchedule?: {
    id: UUIDString;
    date: DateString;
    agendaEntries_on_dailySchedule: ({
      id: UUIDString;
      time: number;
      description: string;
      isCompleted?: boolean | null;
    } & AgendaEntry_Key)[];
  } & DailySchedule_Key;
}

export interface GetDailyScheduleVariables {
  id: UUIDString;
}

export interface UpdateAgendaEntryData {
  agendaEntry_update?: AgendaEntry_Key | null;
}

export interface UpdateAgendaEntryVariables {
  id: UUIDString;
  isCompleted: boolean;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface GetDailyScheduleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDailyScheduleVariables): QueryRef<GetDailyScheduleData, GetDailyScheduleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetDailyScheduleVariables): QueryRef<GetDailyScheduleData, GetDailyScheduleVariables>;
  operationName: string;
}
export const getDailyScheduleRef: GetDailyScheduleRef;

export function getDailySchedule(vars: GetDailyScheduleVariables): QueryPromise<GetDailyScheduleData, GetDailyScheduleVariables>;
export function getDailySchedule(dc: DataConnect, vars: GetDailyScheduleVariables): QueryPromise<GetDailyScheduleData, GetDailyScheduleVariables>;

interface CreateAgendaEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgendaEntryVariables): MutationRef<CreateAgendaEntryData, CreateAgendaEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAgendaEntryVariables): MutationRef<CreateAgendaEntryData, CreateAgendaEntryVariables>;
  operationName: string;
}
export const createAgendaEntryRef: CreateAgendaEntryRef;

export function createAgendaEntry(vars: CreateAgendaEntryVariables): MutationPromise<CreateAgendaEntryData, CreateAgendaEntryVariables>;
export function createAgendaEntry(dc: DataConnect, vars: CreateAgendaEntryVariables): MutationPromise<CreateAgendaEntryData, CreateAgendaEntryVariables>;

interface UpdateAgendaEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgendaEntryVariables): MutationRef<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAgendaEntryVariables): MutationRef<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;
  operationName: string;
}
export const updateAgendaEntryRef: UpdateAgendaEntryRef;

export function updateAgendaEntry(vars: UpdateAgendaEntryVariables): MutationPromise<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;
export function updateAgendaEntry(dc: DataConnect, vars: UpdateAgendaEntryVariables): MutationPromise<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;

