// Recovery/testing only. Not exposed by the daily CLI.
import {resolveBriefContents,projectFromContents} from '../../../scripts/fusion-cli.jsx';
import {resolveStyle} from '../styles/registry.mjs';
import {composeContentSlide} from '../styles/compose.mjs';
export function createProjectFromBrief(brief){
 const style=resolveStyle(brief.styleId),contents=resolveBriefContents(brief,style);
 return projectFromContents(brief,style,contents,contents.map(c=>composeContentSlide(c,style)));
}
