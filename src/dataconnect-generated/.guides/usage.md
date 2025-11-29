# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, getDailySchedule, createAgendaEntry, updateAgendaEntry } from '@dataconnect/generated';


// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation GetDailySchedule:  For variables, look at type GetDailyScheduleVars in ../index.d.ts
const { data } = await GetDailySchedule(dataConnect, getDailyScheduleVars);

// Operation CreateAgendaEntry:  For variables, look at type CreateAgendaEntryVars in ../index.d.ts
const { data } = await CreateAgendaEntry(dataConnect, createAgendaEntryVars);

// Operation UpdateAgendaEntry:  For variables, look at type UpdateAgendaEntryVars in ../index.d.ts
const { data } = await UpdateAgendaEntry(dataConnect, updateAgendaEntryVars);


```