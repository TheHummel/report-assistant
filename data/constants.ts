// Rate limiting constants
export const MONTHLY_EDIT_LIMIT = Infinity; // Set to a number to enforce rate limits; leave as Infinity for unlimited

// Default LaTeX content templates
export const DEFAULT_LATEX_CONTENT = (
  title: string
) => `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${title}}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
This is the main document for your project: ${title}.

\\section{Getting Started}
You can start writing your LaTeX content here.

\\end{document}`;

export const DEFAULT_LATEX_CONTENT_FROM_FILENAME = (fileName: string) => {
  const cleanTitle = fileName.replace(/\.\w+$/, '');
  return `% ${fileName}
% Created on ${new Date().toISOString()}

\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{${cleanTitle}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Your content here.

\\end{document}`;
};

export const NON_LATEX_FILE_CONTENT = (
  fileName: string,
  projectTitle: string,
  fileSize: number | null,
  fileType: string | null
) => `// File: ${fileName}
// Project: ${projectTitle}
// Size: ${fileSize || 'Unknown'} bytes
// Type: ${fileType || 'Unknown'}

// File content would be loaded here in a real implementation.
// This file type (${fileType || 'unknown'}) is not currently supported for editing.`;
