# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetDailySchedule*](#getdailyschedule)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*CreateAgendaEntry*](#createagendaentry)
  - [*UpdateAgendaEntry*](#updateagendaentry)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetDailySchedule
You can execute the `GetDailySchedule` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getDailySchedule(vars: GetDailyScheduleVariables): QueryPromise<GetDailyScheduleData, GetDailyScheduleVariables>;

interface GetDailyScheduleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDailyScheduleVariables): QueryRef<GetDailyScheduleData, GetDailyScheduleVariables>;
}
export const getDailyScheduleRef: GetDailyScheduleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDailySchedule(dc: DataConnect, vars: GetDailyScheduleVariables): QueryPromise<GetDailyScheduleData, GetDailyScheduleVariables>;

interface GetDailyScheduleRef {
  ...
  (dc: DataConnect, vars: GetDailyScheduleVariables): QueryRef<GetDailyScheduleData, GetDailyScheduleVariables>;
}
export const getDailyScheduleRef: GetDailyScheduleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDailyScheduleRef:
```typescript
const name = getDailyScheduleRef.operationName;
console.log(name);
```

### Variables
The `GetDailySchedule` query requires an argument of type `GetDailyScheduleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDailyScheduleVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetDailySchedule` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDailyScheduleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDailySchedule`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDailySchedule, GetDailyScheduleVariables } from '@dataconnect/generated';

// The `GetDailySchedule` query requires an argument of type `GetDailyScheduleVariables`:
const getDailyScheduleVars: GetDailyScheduleVariables = {
  id: ..., 
};

// Call the `getDailySchedule()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDailySchedule(getDailyScheduleVars);
// Variables can be defined inline as well.
const { data } = await getDailySchedule({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDailySchedule(dataConnect, getDailyScheduleVars);

console.log(data.dailySchedule);

// Or, you can use the `Promise` API.
getDailySchedule(getDailyScheduleVars).then((response) => {
  const data = response.data;
  console.log(data.dailySchedule);
});
```

### Using `GetDailySchedule`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDailyScheduleRef, GetDailyScheduleVariables } from '@dataconnect/generated';

// The `GetDailySchedule` query requires an argument of type `GetDailyScheduleVariables`:
const getDailyScheduleVars: GetDailyScheduleVariables = {
  id: ..., 
};

// Call the `getDailyScheduleRef()` function to get a reference to the query.
const ref = getDailyScheduleRef(getDailyScheduleVars);
// Variables can be defined inline as well.
const ref = getDailyScheduleRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDailyScheduleRef(dataConnect, getDailyScheduleVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.dailySchedule);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.dailySchedule);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  displayName: string;
  email?: string | null;
  photoUrl?: string | null;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  displayName: ..., 
  email: ..., // optional
  photoUrl: ..., // optional
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ displayName: ..., email: ..., photoUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  displayName: ..., 
  email: ..., // optional
  photoUrl: ..., // optional
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ displayName: ..., email: ..., photoUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## CreateAgendaEntry
You can execute the `CreateAgendaEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAgendaEntry(vars: CreateAgendaEntryVariables): MutationPromise<CreateAgendaEntryData, CreateAgendaEntryVariables>;

interface CreateAgendaEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgendaEntryVariables): MutationRef<CreateAgendaEntryData, CreateAgendaEntryVariables>;
}
export const createAgendaEntryRef: CreateAgendaEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAgendaEntry(dc: DataConnect, vars: CreateAgendaEntryVariables): MutationPromise<CreateAgendaEntryData, CreateAgendaEntryVariables>;

interface CreateAgendaEntryRef {
  ...
  (dc: DataConnect, vars: CreateAgendaEntryVariables): MutationRef<CreateAgendaEntryData, CreateAgendaEntryVariables>;
}
export const createAgendaEntryRef: CreateAgendaEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAgendaEntryRef:
```typescript
const name = createAgendaEntryRef.operationName;
console.log(name);
```

### Variables
The `CreateAgendaEntry` mutation requires an argument of type `CreateAgendaEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAgendaEntryVariables {
  dailyScheduleId: UUIDString;
  time: number;
  description: string;
  isCompleted: boolean;
  positionInHour: number;
}
```
### Return Type
Recall that executing the `CreateAgendaEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAgendaEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAgendaEntryData {
  agendaEntry_insert: AgendaEntry_Key;
}
```
### Using `CreateAgendaEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAgendaEntry, CreateAgendaEntryVariables } from '@dataconnect/generated';

// The `CreateAgendaEntry` mutation requires an argument of type `CreateAgendaEntryVariables`:
const createAgendaEntryVars: CreateAgendaEntryVariables = {
  dailyScheduleId: ..., 
  time: ..., 
  description: ..., 
  isCompleted: ..., 
  positionInHour: ..., 
};

// Call the `createAgendaEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAgendaEntry(createAgendaEntryVars);
// Variables can be defined inline as well.
const { data } = await createAgendaEntry({ dailyScheduleId: ..., time: ..., description: ..., isCompleted: ..., positionInHour: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAgendaEntry(dataConnect, createAgendaEntryVars);

console.log(data.agendaEntry_insert);

// Or, you can use the `Promise` API.
createAgendaEntry(createAgendaEntryVars).then((response) => {
  const data = response.data;
  console.log(data.agendaEntry_insert);
});
```

### Using `CreateAgendaEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAgendaEntryRef, CreateAgendaEntryVariables } from '@dataconnect/generated';

// The `CreateAgendaEntry` mutation requires an argument of type `CreateAgendaEntryVariables`:
const createAgendaEntryVars: CreateAgendaEntryVariables = {
  dailyScheduleId: ..., 
  time: ..., 
  description: ..., 
  isCompleted: ..., 
  positionInHour: ..., 
};

// Call the `createAgendaEntryRef()` function to get a reference to the mutation.
const ref = createAgendaEntryRef(createAgendaEntryVars);
// Variables can be defined inline as well.
const ref = createAgendaEntryRef({ dailyScheduleId: ..., time: ..., description: ..., isCompleted: ..., positionInHour: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAgendaEntryRef(dataConnect, createAgendaEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agendaEntry_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agendaEntry_insert);
});
```

## UpdateAgendaEntry
You can execute the `UpdateAgendaEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAgendaEntry(vars: UpdateAgendaEntryVariables): MutationPromise<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;

interface UpdateAgendaEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgendaEntryVariables): MutationRef<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;
}
export const updateAgendaEntryRef: UpdateAgendaEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAgendaEntry(dc: DataConnect, vars: UpdateAgendaEntryVariables): MutationPromise<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;

interface UpdateAgendaEntryRef {
  ...
  (dc: DataConnect, vars: UpdateAgendaEntryVariables): MutationRef<UpdateAgendaEntryData, UpdateAgendaEntryVariables>;
}
export const updateAgendaEntryRef: UpdateAgendaEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAgendaEntryRef:
```typescript
const name = updateAgendaEntryRef.operationName;
console.log(name);
```

### Variables
The `UpdateAgendaEntry` mutation requires an argument of type `UpdateAgendaEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAgendaEntryVariables {
  id: UUIDString;
  isCompleted: boolean;
}
```
### Return Type
Recall that executing the `UpdateAgendaEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAgendaEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAgendaEntryData {
  agendaEntry_update?: AgendaEntry_Key | null;
}
```
### Using `UpdateAgendaEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAgendaEntry, UpdateAgendaEntryVariables } from '@dataconnect/generated';

// The `UpdateAgendaEntry` mutation requires an argument of type `UpdateAgendaEntryVariables`:
const updateAgendaEntryVars: UpdateAgendaEntryVariables = {
  id: ..., 
  isCompleted: ..., 
};

// Call the `updateAgendaEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAgendaEntry(updateAgendaEntryVars);
// Variables can be defined inline as well.
const { data } = await updateAgendaEntry({ id: ..., isCompleted: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAgendaEntry(dataConnect, updateAgendaEntryVars);

console.log(data.agendaEntry_update);

// Or, you can use the `Promise` API.
updateAgendaEntry(updateAgendaEntryVars).then((response) => {
  const data = response.data;
  console.log(data.agendaEntry_update);
});
```

### Using `UpdateAgendaEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAgendaEntryRef, UpdateAgendaEntryVariables } from '@dataconnect/generated';

// The `UpdateAgendaEntry` mutation requires an argument of type `UpdateAgendaEntryVariables`:
const updateAgendaEntryVars: UpdateAgendaEntryVariables = {
  id: ..., 
  isCompleted: ..., 
};

// Call the `updateAgendaEntryRef()` function to get a reference to the mutation.
const ref = updateAgendaEntryRef(updateAgendaEntryVars);
// Variables can be defined inline as well.
const ref = updateAgendaEntryRef({ id: ..., isCompleted: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAgendaEntryRef(dataConnect, updateAgendaEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.agendaEntry_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.agendaEntry_update);
});
```

