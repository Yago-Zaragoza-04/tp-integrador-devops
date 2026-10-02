import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * DTOs con allow-list estricta: el ValidationPipe global usa whitelist + forbidNonWhitelisted,
 * así que cualquier propiedad no declarada se rechaza (OWASP A05 / mass assignment).
 */
export class CreateTaskDto {
  @ApiProperty({ example: 'Configurar el pipeline', minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'title no puede estar vacío' })
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Lint, tests y build de la imagen', maxLength: 1000, default: '' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class ReplaceTaskDto {
  @ApiProperty({ example: 'Configurar el pipeline', minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'title no puede estar vacío' })
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Lint, tests y build de la imagen', maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  done: boolean;
}

export class TaskDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Configurar el pipeline' })
  title: string;

  @ApiProperty({ example: 'Lint, tests y build de la imagen' })
  description: string;

  @ApiProperty({ example: false })
  done: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class TaskListDto {
  @ApiProperty({ type: [TaskDto] })
  items: TaskDto[];

  @ApiProperty({ example: 1 })
  total: number;
}

export class ErrorDetailDto {
  @ApiProperty({ example: 'title' })
  field: string;

  @ApiProperty({ example: 'title no puede estar vacío' })
  message: string;
}

export class ErrorDto {
  @ApiProperty({ example: 'validation_error' })
  error: string;

  @ApiProperty({ example: 'El cuerpo de la petición no es válido.' })
  message: string;

  @ApiPropertyOptional({ type: [ErrorDetailDto] })
  details?: ErrorDetailDto[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo en errores 500: correlaciona con los logs' })
  error_id?: string;
}
