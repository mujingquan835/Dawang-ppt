import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const skill = path.resolve(import.meta.dirname, ".."),
  target = path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "skills",
    "dawang-ppt",
  );
const remove = process.argv.includes("--uninstall");
if (remove) {
  if (
    fs.existsSync(target) &&
    fs.lstatSync(target).isSymbolicLink() &&
    fs.realpathSync(target) === fs.realpathSync(skill)
  ) {
    fs.unlinkSync(target);
    console.log("Removed Dawang-PPT link; repository retained");
  } else throw Error("Refusing to remove a different installation");
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (fs.realpathSync(target) !== fs.realpathSync(skill))
      throw Error("An independent dawang-ppt installation already exists");
  } else fs.symlinkSync(skill, target, "dir");
  console.log(target);
}
