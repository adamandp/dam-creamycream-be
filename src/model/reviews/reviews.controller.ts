import { Public, Roles } from '../../decorators/access.decorator';
import { AccountsClient } from '../../integrations/accounts/accounts.client';
import { Req } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtPayload } from '../../integrations/accounts/accounts.interface';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import type { WebResponse } from '../../common/common.interface';
import {
  FindAllReviewResDto as FindAllDto,
  FindByIdReviewResDto as FindByIdDto,
  FindByProductReviewResDto as FindByProductDto,
  FindByUserReviewResDto as FindByUserDto,
} from './reviews.interface';
import { PaginationDto } from '../../common/common.dto';

@Roles('STORE_ADMIN')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly accounts: AccountsClient,
  ) {}

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Post()
  async create(
    @CurrentUser() actor: JwtPayload,
    @Req() req: ExpressRequest,
    @Body() body: CreateReviewDto,
  ): Promise<WebResponse> {
    const profile = await this.accounts.profile(
      req.headers.authorization!,
      actor.sub,
    );
    return this.reviewsService.create(body, actor, profile);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindAllDto>> {
    return this.reviewsService.findAll(pagination);
  }

  @Public()
  @Get('product/:id')
  findByProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindByProductDto>> {
    return this.reviewsService.findByProduct(id, pagination);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get('me')
  findByUser(
    @CurrentUser() request: JwtPayload,
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.reviewsService.findByUser(request, pagination);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.reviewsService.findById(id);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Patch(':id')
  update(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<WebResponse> {
    return this.reviewsService.update(id, updateReviewDto, actor);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Delete(':id')
  remove(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewsService.remove(id, actor);
  }
}
