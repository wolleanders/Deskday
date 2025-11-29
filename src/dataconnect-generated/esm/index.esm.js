import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'deskday',
  location: 'europe-west2'
};

export const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';

export function createUser(dcOrVars, vars) {
  return executeMutation(createUserRef(dcOrVars, vars));
}

export const getDailyScheduleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDailySchedule', inputVars);
}
getDailyScheduleRef.operationName = 'GetDailySchedule';

export function getDailySchedule(dcOrVars, vars) {
  return executeQuery(getDailyScheduleRef(dcOrVars, vars));
}

export const createAgendaEntryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgendaEntry', inputVars);
}
createAgendaEntryRef.operationName = 'CreateAgendaEntry';

export function createAgendaEntry(dcOrVars, vars) {
  return executeMutation(createAgendaEntryRef(dcOrVars, vars));
}

export const updateAgendaEntryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgendaEntry', inputVars);
}
updateAgendaEntryRef.operationName = 'UpdateAgendaEntry';

export function updateAgendaEntry(dcOrVars, vars) {
  return executeMutation(updateAgendaEntryRef(dcOrVars, vars));
}

