import { Injectable } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PinoLogger } from 'nestjs-pino';
import { WebResponse } from '../../common/common.interface';
import { Messages } from '../../utils/message.helper';
import { ProductsService } from '../products/products.service';
import { PaginationDto } from '../../common/common.dto';
import { NotFoundException } from '../../exceptions';
import {
  ValidateReviewResDto as ValidateDto,
  FindAllReviewResDto as FindAllDto,
  FindByIdReviewResDto as FindByIdDto,
  FindByProductReviewResDto as FindByProductDto,
  FindByUserReviewResDto as FindByUserDto,
} from './reviews.interface';
import { validateUpdate } from '../../utils/validate-update';
import { JwtPayload } from '../../integrations/accounts/accounts.interface';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,

    private readonly product: ProductsService,
  ) {
    this.logger.setContext(ReviewsService.name);
  }

  private name = 'Review';

  async validateReview(id: string): Promise<WebResponse<ValidateDto>> {
    return await this.prisma.review
      .findUniqueOrThrow({
        where: { id },
        omit: { reviewerName: true, reviewerImageUrl: true },
      })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async create(
    body: CreateReviewDto,
    actor: JwtPayload,
    profile: {
      username: string | null;
      name: string | null;
      imageUrl: string | null;
    },
  ): Promise<WebResponse> {
    await this.product.validateProduct(body.productId);
    return this.prisma.review
      .create({
        data: {
          ...body,
          userId: actor.sub,
          reviewerName: profile.username ?? profile.name,
          reviewerImageUrl: null,
        },
      })
      .then(() => ({ message: Messages.create(this.name) }));
  }

  async findAll({
    limit,
    page,
  }: PaginationDto): Promise<WebResponse<FindAllDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.review.findMany({
        omit: { reviewerName: true, reviewerImageUrl: true },
        skip,
        take: limit,
      }),
      this.prisma.review.count(),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async findById(id: string): Promise<WebResponse<FindByIdDto>> {
    return await this.prisma.review
      .findUniqueOrThrow({
        where: { id },
        omit: { reviewerName: true, reviewerImageUrl: true },
      })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findByUser(
    request: JwtPayload,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    const { sub } = request;

    return await Promise.all([
      this.prisma.review.findMany({
        where: { userId: sub },
        omit: { reviewerName: true, reviewerImageUrl: true },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { userId: sub } }),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async findByProduct(
    productId: string,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByProductDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    const product = await this.product.validateProduct(productId);
    if (!product.data?.isActive) throw new NotFoundException('Product');
    return await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewerName: true,
          reviewerImageUrl: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { productId } }),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      const parsedData = data.map((review) => ({
        id: review.id,
        rate: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        name: review.reviewerName ?? 'Customer',
        imageUrl: review.reviewerImageUrl,
      }));
      return {
        message: Messages.get(this.name),
        data: parsedData,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async update(
    id: string,
    body: UpdateReviewDto,
    actor: JwtPayload,
  ): Promise<WebResponse> {
    const exsitingReview = await this.prisma.review.findUniqueOrThrow({
      where: { id, userId: actor.sub },
    });
    return this.prisma.review
      .update({
        where: { id, userId: actor.sub },
        data: validateUpdate(body, exsitingReview),
      })
      .then(() => ({ message: Messages.update(this.name) }));
  }

  async remove(id: string, actor: JwtPayload): Promise<WebResponse> {
    return this.prisma.review
      .delete({ where: { id, userId: actor.sub } })
      .then(() => ({ message: Messages.delete(this.name) }));
  }
}
