/** Fulfils the `TodoCreate` action — see ../models/TodoCreate.model.bxb. */
const voiceApi = require('./voiceApi.js');

module.exports.function = function createTodo(title) {
  return voiceApi.run('todo.create', { title });
};
