//-----------------------------------------------------------------------------
/**
  @file $relPath
  @copyright Copyright 2026 winccoa-tools-pack
             SPDX-License-Identifier: MIT
  @brief Run astyle against CTL sources from the worker (source) project.
  @details Resolves astyle.config via getPath (source project, StyleCheck
           sub-project, then WinCC OA installation). Logs via throwError.
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

  @param sourcePath Directory to scan recursively for CTL files.
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

  dyn_string files = getFileNamesRecursive(sourcePath, "*.ctl");
  dyn_string filesToCheck;

  for (int i = 1; i <= dynlen(files); i++)
  {
    const string path = makeUnixPath(files[i]);
    dynAppend(filesToCheck, makeNativePath(path));
  }

  if (dynlen(filesToCheck) == 0)
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

  dynAppend(args, "--formatted");
  dynAppend(args, filesToCheck);

  logMsg(PRIO_INFO,
         "Running astyle on " + dynlen(filesToCheck) +
         " file(s); applyChanges=" + applyChanges +
         "; options=" + optionsFile);

  int rc = system(args, stdOut, stdErr);

  strreplace(stdOut, "\r", "");
  strreplace(stdErr, "\r", "");

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
        const int firstSpace = strpos(line, " ");
        string path = firstSpace > 0 ? strltrim(strrtrim(substr(line, firstSpace))) : line;
        logMsg(applyChanges ? PRIO_INFO : PRIO_WARNING, "formatted: " + path);

        if (applyChanges)
        {
          logMsg(PRIO_INFO, "The file has been formatted: " + path);
        }
        else
        {
          // keep the \n\tLocation for CI log parsers to detect the file path ;-)
          logMsg(PRIO_WARNING, "The file has wrong formatting, Location:\n\t" + path);
        }
      }
    }

    

    // Dry-run must fail when any file would be reformatted.
    if (!applyChanges && n > 0)
    {
      rc = 1;
      logMsg(PRIO_WARNING,
             "astyle found unformatted files: " + n +
             "; return code set to " + rc);
    }
  }

  if (stdErr != "")
    logMsg(PRIO_WARNING, "astyle stderr:\n" + stdErr);

  if (rc != 0)
  {
    logMsg(PRIO_SEVERE, "astyle failed with return code " + rc);
    exit(rc);
  }

  logMsg(PRIO_INFO, "astyle completed successfully");
  exit(0);
}