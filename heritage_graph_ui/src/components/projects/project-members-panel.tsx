"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { glassCard } from "@/lib/design";
import {
  addProjectMembership,
  removeProjectMembership,
  type ProjectDetail,
  type ProjectMembershipRow,
} from "@/lib/projects-api";

export function ProjectMembersPanel({
  project,
  accessToken,
  canEdit,
  onChange,
}: {
  project: ProjectDetail;
  accessToken: string;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("editor");
  const [submitting, setSubmitting] = useState(false);

  const invite = async () => {
    if (!username.trim()) return;
    setSubmitting(true);
    try {
      await addProjectMembership(project.slug, accessToken, {
        username: username.trim(),
        role,
      });
      toast.success("Collaborator added.");
      setUsername("");
      onChange();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not add member."));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (m: ProjectMembershipRow) => {
    if (!confirm(`Remove ${m.user.username} from this project?`)) return;
    try {
      await removeProjectMembership(project.slug, m.id, accessToken);
      toast.success("Member removed.");
      onChange();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className={`${glassCard} p-3 flex items-center justify-between`}>
        <div>
          <span className="font-medium text-sm">{project.owner.username}</span>
          <span className="text-xs text-muted-foreground ml-2">{project.owner.email}</span>
        </div>
        <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          owner
        </Badge>
      </div>
      {project.memberships.map((m) => (
        <div key={m.id} className={`${glassCard} p-3 flex items-center justify-between gap-2`}>
          <div className="min-w-0">
            <span className="font-medium text-sm">{m.user.username}</span>
            <span className="text-xs text-muted-foreground ml-2">{m.user.email}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">
              {m.role}
            </Badge>
            {canEdit && m.role !== "owner" && (
              <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => void remove(m)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}
      {canEdit && (
        <div className={`${glassCard} p-4 space-y-3`}>
          <p className="text-sm font-medium">Invite collaborator</p>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Django username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="domain_expert">Domain expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={submitting} onClick={() => void invite()}>
            {submitting ? "Adding…" : "Add member"}
          </Button>
        </div>
      )}
    </div>
  );
}
