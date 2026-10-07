import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { TransactionQueryRepository } from '../../infrastructure/database/transaction-query.repository';
import { StatementResponseDto } from '../dtos/account-statement-query.dto';

//controller para consulta de extrato
@Controller('statements')
export class AccountStatementController {
  constructor(private readonly queryRepo: TransactionQueryRepository) { }

  @Get()
  async getStatement(
    @Headers('x-client-id') clientIdHeader?: string,
    @Query('clientId') clientIdQuery?: string,
    @Query('limit') limitStr?: string,
    @Query('cursorDate') cursorDate?: string,
    @Query('cursorId') cursorId?: string,
  ): Promise<StatementResponseDto> {
    const clientId = clientIdHeader || clientIdQuery;
    if (!clientId) {
      throw new UnauthorizedException('Identificação do cliente é obrigatória.');
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    if (isNaN(limit) || limit <= 0) {
      throw new BadRequestException('Parâmetro limit deve ser um número positivo.');
    }

    return this.queryRepo.getStatementByClient({
      clientId,
      limit,
      cursorDate,
      cursorId,
    });
  }
}
