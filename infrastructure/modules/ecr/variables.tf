variable "project" { type = string }
variable "environment" { type = string }
variable "repos" {
  description = "List of repo suffixes (e.g. ['backend', 'mcp-pricing'])"
  type        = list(string)
}
