/**
 * How the attributes are laid out.
 *
 * `column` means: everything stacked in one column, the attributes as a
 * flat bar below the title. The narrow side panel can't do anything else —
 * a second column there would just be a stack with a divider line.
 *
 * `aside` is the two-column layout of the large dialog and the full page:
 * content on the left, attributes next to it on the right. There's the
 * width for that there, and having both in view at once is worth more than
 * top-to-bottom reading flow.
 */
export type IssueDetailLayout = "column" | "aside";
