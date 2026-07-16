export function npmCommand() {
  return process.platform === 'win32'
    ? (process.env.ComSpec || 'cmd.exe')
    : 'npm';
}

export function npmCommandArgs(args = []) {
  return process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm', ...args]
    : args;
}

export function npmCommandOptions(options = {}) {
  return options;
}
