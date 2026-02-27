import { prisma } from "@/lib/prisma";
import { loadFilesystemGraph } from "@/server/graph/filesystemGraph";
import type {
  GraphState,
  SkillNodeInfo,
  SkillEdgeInfo,
  CreateSkillRequest,
  UpdateSkillRequest,
  CreateSkillEdgeRequest,
} from "@/lib/types";

function toSkillNodeInfo(skill: {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  mcpEndpoint: string | null;
  config: string;
  posX: number;
  posY: number;
  nodeType: string;
  createdAt: Date;
  updatedAt: Date;
}): SkillNodeInfo {
  return {
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    description: skill.description,
    mcpEndpoint: skill.mcpEndpoint,
    config: skill.config,
    posX: skill.posX,
    posY: skill.posY,
    nodeType: skill.nodeType,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}

function toSkillEdgeInfo(edge: {
  id: string;
  sourceId: string;
  targetId: string;
  label: string | null;
  animated: boolean;
  createdAt: Date;
}): SkillEdgeInfo {
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    label: edge.label,
    animated: edge.animated,
    createdAt: edge.createdAt.toISOString(),
  };
}

class GraphManager {
  private async getProjectGraphPath(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { type: true, path: true },
    });
    if (!project) return null;
    if (project.type !== "LOCAL") return null;
    return project.path;
  }

  async getGraphState(projectId: string): Promise<GraphState> {
    const projectPath = await this.getProjectGraphPath(projectId);
    if (projectPath) {
      const fileGraph = await loadFilesystemGraph(projectId, projectPath);
      if (fileGraph) {
        return fileGraph;
      }
    }

    const skills = await prisma.skill.findMany({
      where: { projectId },
      include: { edgesFrom: true, edgesTo: true },
      orderBy: { createdAt: "asc" },
    });

    const nodes: SkillNodeInfo[] = skills.map(toSkillNodeInfo);

    // Collect unique edges from edgesFrom across all skills
    const edgeMap = new Map<string, SkillEdgeInfo>();
    for (const skill of skills) {
      for (const edge of skill.edgesFrom) {
        if (!edgeMap.has(edge.id)) {
          edgeMap.set(edge.id, toSkillEdgeInfo(edge));
        }
      }
      for (const edge of skill.edgesTo) {
        if (!edgeMap.has(edge.id)) {
          edgeMap.set(edge.id, toSkillEdgeInfo(edge));
        }
      }
    }

    return {
      projectId,
      nodes,
      edges: Array.from(edgeMap.values()),
      readOnly: false,
      source: "db",
    };
  }

  async createSkill(req: CreateSkillRequest): Promise<SkillNodeInfo> {
    const skill = await prisma.skill.create({
      data: {
        projectId: req.projectId,
        name: req.name,
        description: req.description ?? null,
        mcpEndpoint: req.mcpEndpoint ?? null,
        nodeType: req.nodeType ?? "default",
        posX: req.posX ?? 0,
        posY: req.posY ?? 0,
      },
    });
    return toSkillNodeInfo(skill);
  }

  async updateSkill(
    id: string,
    data: UpdateSkillRequest,
  ): Promise<SkillNodeInfo> {
    const skill = await prisma.skill.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.mcpEndpoint !== undefined && {
          mcpEndpoint: data.mcpEndpoint,
        }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.posX !== undefined && { posX: data.posX }),
        ...(data.posY !== undefined && { posY: data.posY }),
        ...(data.nodeType !== undefined && { nodeType: data.nodeType }),
      },
    });
    return toSkillNodeInfo(skill);
  }

  async deleteSkill(id: string): Promise<void> {
    // SkillEdge has onDelete: Cascade, so edges are auto-removed
    await prisma.skill.delete({ where: { id } });
  }

  async createEdge(req: CreateSkillEdgeRequest): Promise<SkillEdgeInfo> {
    const edge = await prisma.skillEdge.create({
      data: {
        sourceId: req.sourceId,
        targetId: req.targetId,
        label: req.label ?? null,
        animated: req.animated ?? false,
      },
    });
    return toSkillEdgeInfo(edge);
  }

  async deleteEdge(id: string): Promise<void> {
    await prisma.skillEdge.delete({ where: { id } });
  }

  async updatePositions(
    updates: { id: string; posX: number; posY: number }[],
  ): Promise<void> {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.skill.update({
          where: { id: u.id },
          data: { posX: u.posX, posY: u.posY },
        }),
      ),
    );
  }

  async getSkillsByProject(projectId: string): Promise<SkillNodeInfo[]> {
    const projectPath = await this.getProjectGraphPath(projectId);
    if (projectPath) {
      const fileGraph = await loadFilesystemGraph(projectId, projectPath);
      if (fileGraph) {
        return fileGraph.nodes;
      }
    }

    const skills = await prisma.skill.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return skills.map(toSkillNodeInfo);
  }
}

export const graphManager = new GraphManager();
