const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'deskday',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

const createUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser', inputVars);
}
createUserRef.operationName = 'CreateUser';
exports.createUserRef = createUserRef;

exports.createUser = function createUser(dcOrVars, vars) {
  return executeMutation(createUserRef(dcOrVars, vars));
};

const getDailyScheduleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDailySchedule', inputVars);
}
getDailyScheduleRef.operationName = 'GetDailySchedule';
exports.getDailyScheduleRef = getDailyScheduleRef;

exports.getDailySchedule = function getDailySchedule(dcOrVars, vars) {
  return executeQuery(getDailyScheduleRef(dcOrVars, vars));
};

const createAgendaEntryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgendaEntry', inputVars);
}
createAgendaEntryRef.operationName = 'CreateAgendaEntry';
exports.createAgendaEntryRef = createAgendaEntryRef;

exports.createAgendaEntry = function createAgendaEntry(dcOrVars, vars) {
  return executeMutation(createAgendaEntryRef(dcOrVars, vars));
};

const updateAgendaEntryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgendaEntry', inputVars);
}
updateAgendaEntryRef.operationName = 'UpdateAgendaEntry';
exports.updateAgendaEntryRef = updateAgendaEntryRef;

exports.updateAgendaEntry = function updateAgendaEntry(dcOrVars, vars) {
  return executeMutation(updateAgendaEntryRef(dcOrVars, vars));
};
