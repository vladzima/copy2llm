// Regenerate public/.well-known/agent-skills from the canonical skill in
// /skills (Agent Skills Discovery RFC v0.2.0). Copy + hash happen together so
// the published digest always matches the served bytes.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const skill = readFileSync(
  new URL("../../../skills/copy2llm/SKILL.md", import.meta.url)
);
const description = /^description:\s*(.+)$/m.exec(skill.toString())?.[1];
if (!description) {
  throw new Error("SKILL.md frontmatter has no description");
}

const outDir = new URL(
  "../public/.well-known/agent-skills/copy2llm/",
  import.meta.url
);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL("SKILL.md", outDir), skill);

const index = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills: [
    {
      name: "copy2llm",
      type: "skill-md",
      description,
      url: "https://copy.computer/.well-known/agent-skills/copy2llm/SKILL.md",
      digest: `sha256:${createHash("sha256").update(skill).digest("hex")}`,
    },
  ],
};
writeFileSync(
  new URL("../index.json", outDir),
  `${JSON.stringify(index, null, 2)}\n`
);
