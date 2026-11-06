/**
 * Multi-line sibling of TextField — app port of the web TextArea (upstream
 * #21): same label, error and automation contract (`testID` required,
 * `${testID}.error`), plus an optional `${testID}.hint` line.
 */
import { Field, type TextFieldProps } from './TextField';

export interface TextAreaProps extends Omit<TextFieldProps, 'onSubmitEditing' | 'returnKeyType'> {
  /** Visible lines (web `rows`, default 4). */
  rows?: number;
  maxLength?: number;
  /** Quiet line under the field, e.g. a character count. */
  hint?: string;
}

export function TextArea({ rows = 4, maxLength, hint, ...rest }: TextAreaProps) {
  return <Field {...rest} multiline={{ rows, maxLength, hint }} />;
}
