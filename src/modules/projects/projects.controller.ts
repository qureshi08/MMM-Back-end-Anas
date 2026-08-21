import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProjectsService, ProjectWithCounts } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { assertWriteAccess } from '../../common/auth/permissions';
import { Project } from './entities/project.entity';
import { User } from '../users/entities/user.entity';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto): Promise<Project> {
    assertWriteAccess(user);
    return this.projects.create(user.userId!, user.tenantId!, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ProjectWithCounts[]> {
    return this.projects.findAll(user.userId!, user.globalRole!);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<ProjectWithCounts> {
    return this.projects.findOne(id, user.userId!, user.globalRole!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectDto,
  ): Promise<Project> {
    assertWriteAccess(user);
    return this.projects.update(id, user.userId!, user.globalRole!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    assertWriteAccess(user);
    return this.projects.remove(id, user.userId!, user.globalRole!);
  }

  @Get(':id/members')
  listMembers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<User[]> {
    return this.projects.listMembers(id, user.userId!, user.globalRole!);
  }

  /** Adds an existing tenant member to this project's visibility list — Master or the project owner only. */
  @Post(':id/members')
  @HttpCode(HttpStatus.NO_CONTENT)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddProjectMemberDto,
  ): Promise<void> {
    return this.projects.addMember(id, user.userId!, user.globalRole!, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.projects.removeMember(id, user.userId!, user.globalRole!, memberUserId);
  }
}
