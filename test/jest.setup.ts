import { Logger } from '@nestjs/common';

jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger, 'debug').mockImplementation(() => undefined);
