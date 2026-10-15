// 本机路径脱敏:错误输出/日志给用户前抹掉绝对路径(单一实现;此前 5 个文件各持副本,
// render CLI 的副本漏了 /tmp,在 Linux CI 上把临时目录原样泄漏进错误消息)。
export function scrubLocalPaths(value) {
  return String(value || '')
    .replace(/file:\/\/\/?[^\s"'`<>),;]*/gi, '<local-path>')
    .replace(/\/(?:private\/)?var\/[^\s"'`<>),;\r\n]+(?:\/[^/\\"'`<>),;\r\n]+)*/g, '<local-path>')
    .replace(/\/tmp\/[^/\\"'`<>),;\r\n]+(?:\/[^/\\"'`<>),;\r\n]+)*/g, '<local-path>')
    .replace(/\/Users\/[^/\\"'`<>),;\r\n]+(?:\/[^/\\"'`<>),;\r\n]+)*/g, '<local-path>')
    .replace(/\/Volumes\/[^/\\"'`<>),;\r\n]+(?:\/[^/\\"'`<>),;\r\n]+)*/g, '<local-path>')
    .replace(/\/home\/[^/\\"'`<>),;\r\n]+(?:\/[^/\\"'`<>),;\r\n]+)*/g, '<local-path>')
    .replace(/(?<![A-Za-z])[A-Za-z]:[\\/][^\s"'`<>),;]+(?:[\\/][^\s"'`<>),;]+)*/g, '<local-path>');
}
