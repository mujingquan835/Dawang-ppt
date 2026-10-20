import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const targetIndex=process.argv.indexOf("--target");
if(targetIndex>=0&&!process.argv[targetIndex+1])throw Error("--target needs an explicit path");
const skill = path.resolve(import.meta.dirname, ".."),
  target = targetIndex>=0?path.resolve(process.argv[targetIndex+1]):path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "skills",
    "dawang-ppt",
  );
const replaceIndex=process.argv.indexOf("--replace-link");
const expectedPrevious=replaceIndex<0?null:process.argv[replaceIndex+1];
if(replaceIndex>=0&&(!expectedPrevious||expectedPrevious.startsWith("--")))throw Error("--replace-link needs the expected old skill path");
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
    if (fs.realpathSync(target) !== fs.realpathSync(skill)) {
      if (!expectedPrevious || !fs.lstatSync(target).isSymbolicLink() ||
          fs.realpathSync(target)!==fs.realpathSync(expectedPrevious))
        throw Error("An independent dawang-ppt installation already exists; explicit matching --replace-link required");
      const previousTarget=fs.readlinkSync(target),nextTarget=skill;
      const stamp=Date.now()+"-"+process.pid,rollbackFile=target+".rollback-"+stamp+".json",temporary=target+".next-"+stamp;
      fs.writeFileSync(rollbackFile,JSON.stringify({target,previousTarget,nextTarget,date:new Date().toISOString()},null,2),{flag:"wx"});
      try {fs.symlinkSync(nextTarget,temporary,"dir");fs.renameSync(temporary,target);}
      finally {if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
      console.log(JSON.stringify({target,previousTarget,nextTarget,rollbackFile}));
      process.exit(0);
    }
  } else fs.symlinkSync(skill, target, "dir");
  console.log(target);
}
