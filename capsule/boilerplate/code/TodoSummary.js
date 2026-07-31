/** Fulfils the `TodoSummary` action — see ../models/TodoSummary.model.bxb. */
const voiceApi = require('./voiceApi.js');

module.exports.function = function getTodoSummary() {
  return voiceApi.run('todo.summary', {});
};
