# Contributing

1. Create a feature branch from `main`:

   ```sh
   git checkout main
   git pull
   git checkout -b feat/short-description
   ```

2. Make your change. Run the tests:

   ```sh
   npm install
   npm test
   ```

3. Commit with a conventional message (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) and push:

   ```sh
   git push -u origin HEAD
   ```

4. Open a pull request:

   ```sh
   gh pr create
   ```

   In the description, explain why the change belongs in Dot Run: the problem it solves, who hits it, and how you verified it. Feature changes should also add a dated entry to `CHANGELOG.md`.
