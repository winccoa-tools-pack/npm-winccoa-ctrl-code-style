//-----------------------------------------------------------------------------
/**
  @file $relPath
  @copyright Copyright 2026 winccoa-tools-pack
             SPDX-License-Identifier: MIT
  @brief Run astyle against CTL sources from the worker (source) project.
  @details Resolves astyle.config via getPath (source project, StyleCheck
           sub-project, then WinCC OA installation). Logs via throwError.
           sourcePath must be a full native absolute directory path —
           getFileNamesRecursive does not resolve CWD-relative paths.
           astyle --formatted prints only files that would change; empty
           stdout means every scanned file already matches style.
           Optional developer traces: WCCOActrl -dbg STYLE (DebugFTN).
  @AIgeneratedHelpContent
*/

#uses "fileSystem"

//-----------------------------------------------------------------------------
/**
  @brief Emit a CTRL log line via throwError for CI log parsers.
  @param prio Error priority (PRIO_INFO / PRIO_WARNING / PRIO_SEVERE).
  @param text Message text.
*/
void logMsg(int prio, const string &text)
{
  throwError(makeError("", prio, ERR_CONTROL, prio == PRIO_INFO ? 0 : 54, text));
}

//-----------------------------------------------------------------------------
/**
  Run astyle for all CTL files below the given source path.

  @param sourcePath Full native absolute directory to scan for CTL files.
  @param applyChanges If true, format files in place. If false, dry-run only.
*/
main(string sourcePath, bool applyChanges = FALSE)
{
  dyn_string args;
  string stdErr;
  string stdOut;

  if (sourcePath.isEmpty())
  {
    logMsg(PRIO_SEVERE, "sourcePath must not be empty");
    exit(2);
  }

  // getFileNamesRecursive needs a full native path (not CWD-relative).
  sourcePath = makeNativePath(sourcePath);

  if (!isdir(sourcePath))
  {
    logMsg(PRIO_SEVERE,
           "sourcePath is not an existing directory (need full native path): " +
           sourcePath);
    exit(2);
  }

  logMsg(PRIO_INFO, "Scanning CTL sources under: " + sourcePath);
  DebugFTN("STYLE", "sourcePath", sourcePath, "applyChanges", applyChanges);

  dyn_string files = getFileNamesRecursive(sourcePath, "*.ctl");
  dyn_string filesToCheck;

  for (int i = 1; i <= dynlen(files); i++)
  {
    // Keep full native paths for astyle argv.
    dynAppend(filesToCheck, makeNativePath(files[i]));
  }

  int fileCount = dynlen(filesToCheck);
  DebugFTN("STYLE", "ctlFileCount", fileCount);
  if (fileCount == 0)
  {
    logMsg(PRIO_WARNING, "No .ctl files found below " + sourcePath);
    exit(1);
  }

  string astyleBin = getPath(BIN_REL_PATH, _WIN32 ? "astyle.exe" : "astyle");
  if (astyleBin.isEmpty())
  {
    logMsg(PRIO_SEVERE, "astyle executable not found in WinCC OA bin path");
    exit(2);
  }

  // Search order: worker project config, StyleCheck sub-project, OA install.
  string optionsFile = getPath(CONFIG_REL_PATH, "astyle.config");
  if (optionsFile.isEmpty())
  {
    logMsg(PRIO_SEVERE, "astyle.config not found via getPath(CONFIG_REL_PATH)");
    exit(2);
  }

  args[1] = astyleBin;
  args[2] = "--options=" + makeNativePath(optionsFile);
  args[3] = "--suffix=none";
  if (!applyChanges)
    args[4] = "--dry-run";

  // --formatted: only list files that astyle would change (or did change).
  // Unchanged files produce no stdout line — empty stdout is a clean tree.
  dynAppend(args, "--formatted");
  dynAppend(args, filesToCheck);

  DebugFTN("STYLE", "astyleBin", astyleBin, "optionsFile", optionsFile,
           "argc", dynlen(args));

  // Cast numerics/bools so CTRL string concat cannot drop the count.
  logMsg(PRIO_INFO,
         "Running astyle on " + (string)fileCount +
         " file(s); applyChanges=" + (string)applyChanges +
         "; options=" + optionsFile);

  int rc = system(args, stdOut, stdErr);

  strreplace(stdOut, "\r", "");
  strreplace(stdErr, "\r", "");

  int outLen = strlen(stdOut);
  int errLen = strlen(stdErr);
  DebugFTN("STYLE", "astyleRc", rc, "stdoutLen", outLen, "stderrLen", errLen);
  logMsg(PRIO_INFO,
         "astyle finished rc=" + (string)rc +
         " stdoutBytes=" + (string)outLen +
         " stderrBytes=" + (string)errLen);

  if (stdOut != "")
  {
    dyn_string lines = strsplit(stdOut, "\n");
    int n = 0;
    for (int i = 1; i <= dynlen(lines); i++)
    {
      const string line = lines[i];
      if (!line.isEmpty())
      {
        n++;
        // astyle line: "<status> <path>" (locale may vary, e.g. Formatiert).
        const int firstSpace = strpos(line, " ");
        string path = firstSpace > 0
                        ? strltrim(strrtrim(substr(line, firstSpace)))
                        : line;
        DebugFTN("STYLE", "formattedLine", n, line);

        if (applyChanges)
        {
          logMsg(PRIO_INFO, "The file has been formatted: " + path);
        }
        else
        {
          // \n\tLocation for CI log parsers (file path after tab).
          logMsg(PRIO_WARNING,
                 "The file has wrong formatting, Location:\n\t" + path);
        }
      }
    }

    // Dry-run must fail when any file would be reformatted.
    if (!applyChanges && n > 0)
    {
      rc = 1;
      logMsg(PRIO_WARNING,
             "astyle found unformatted files: " + (string)n +
             "; return code set to " + (string)rc);
    }
  }
  else
  {
    // Expected with --formatted when every file already matches style.
    logMsg(PRIO_INFO,
           "astyle stdout empty with --formatted: all " +
           (string)fileCount +
           " file(s) already match style (no reformats)");
  }

  if (stdErr != "")
    logMsg(PRIO_WARNING, "astyle stderr:\n" + stdErr);

  if (rc != 0)
  {
    logMsg(PRIO_SEVERE, "astyle failed with return code " + (string)rc);
    exit(rc);
  }

  logMsg(PRIO_INFO, "astyle completed successfully");
  exit(0);
}