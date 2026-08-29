/**
 * `webkitdirectory` turns a file input into a folder picker. It is supported by
 * every current browser but never made it into React's InputHTMLAttributes, so
 * without this augmentation the folder picker in CreateProjectWizard is a type
 * error. `directory` is the unprefixed spelling some engines also accept.
 */
import 'react'

declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
    directory?: string
  }
}
