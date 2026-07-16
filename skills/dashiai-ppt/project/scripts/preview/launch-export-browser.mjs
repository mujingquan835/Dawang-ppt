// 导出浏览器统一启动器:三个导出入口(HTTP 的 PPTX/PDF 路由 + CLI)共用,收敛
// tmpdir 保险丝、headless shell 优先解析、以及沙箱宿主下的 --single-process 重试。
//
// 沙箱宿主(如豆包)的 seatbelt 会被 daemonize 的预览服务继承,对 Chromium 的拦截
// 逐层出现过三种形态(均为真实事故):
//   1. mkdtemp ENOENT/EPERM —— 临时目录死亡/不可写(ensure-tmpdir.mjs 处理);
//   2. ProcessSingleton socket 创建失败 —— confstr 临时区被拦(headless shell 无此机制);
//   3. Mach 端口注册被拒 —— bootstrap_check_in Permission denied (1100),多进程
//      Chromium(含 headless shell)启动早期必经;唯一可行规避是 --single-process
//      (不派生子进程 → 不需要 Mach rendezvous)。
// 策略:默认常规启动(最大兼容);失败信息命中沙箱特征时,带
// --single-process --in-process-gpu 自动重试一次。导出渲染的是本 skill 自己生成的
// 受控静态页面、进程短生命周期,single-process 模式的稳定性代价在此场景可忽略。
import { getExportBrowserPath } from '../chrome-path.mjs';
import { resolveBrowserTmpdir } from './ensure-tmpdir.mjs';

export const SANDBOX_LAUNCH_FAILURE_RE = /bootstrap_check_in|MachPortRendezvous|ProcessSingleton|Permission denied \(1100\)|mkdtemp/i;

export async function launchExportBrowser(chromium, { fallbackTmpDirs = [], log = () => {} } = {}) {
  const browserTmpdir = resolveBrowserTmpdir(fallbackTmpDirs, log);
  const baseOptions = {
    headless: true,
    executablePath: getExportBrowserPath(),
    env: { ...process.env, TMPDIR: browserTmpdir },
  };
  try {
    return await chromium.launch(baseOptions);
  } catch (error) {
    const message = String((error && error.message) || error);
    if (!SANDBOX_LAUNCH_FAILURE_RE.test(message)) throw error;
    log('[export] 浏览器常规启动被宿主沙箱拦截(Mach/Singleton/tmp),改用 --single-process 重试');
    // --disable-gpu:第 4 层防线。single-process + in-process-gpu 会把 GPU 初始化
    // 拉进浏览器主进程,进而向 WindowServer 查询真实显示器建立刷新同步
    // (CVDisplayLinkCreateWithCGDisplay);豆包的服务上下文接触不到图形会话,
    // 该调用返回 kCVReturnInvalidDisplay 后浏览器直接崩溃(newPage 时报
    // "browser has been closed")。headless 导出全程用软件渲染即可,不碰显示服务。
    return chromium.launch({ ...baseOptions, args: ['--single-process', '--in-process-gpu', '--disable-gpu'] });
  }
}
