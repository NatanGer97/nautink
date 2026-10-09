/** The codebase folder Claude may read, kept in memory. `REPO_DIR` sets it; `POST /api/repo` changes it. */
export class RepoSelection {
  private repoDir: string | null;

  constructor(initialRepoDir: string | null) {
    this.repoDir = initialRepoDir;
  }

  get(): string | null {
    return this.repoDir;
  }

  set(repoDir: string | null): void {
    this.repoDir = repoDir;
  }
}
