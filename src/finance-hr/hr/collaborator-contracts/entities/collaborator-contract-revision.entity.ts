import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CollaboratorContract } from './collaborator-contract.entity';

/**
 * Bitácora de enmiendas de un contrato.
 *
 * Legal necesita poder responder "¿cuándo le subimos el sueldo y quién lo autorizó?" mucho
 * después de que el valor viejo haya desaparecido de la fila. Por eso cada PUT que cambia
 * términos deja aquí el antes/después, y el contrato en sí sigue siendo la foto vigente.
 */
@Entity('collaborator_contract_revisions')
export class CollaboratorContractRevision {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 12, description: 'Contract the amendment belongs to' })
  @Column({ name: 'contract_id' })
  contract_id: number;

  @ManyToOne(() => CollaboratorContract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: CollaboratorContract;

  @ApiProperty({ example: 'wage_rate', description: 'Amended field' })
  @Column({ type: 'varchar', length: 60 })
  field: string;

  @ApiProperty({ example: '22.50', nullable: true })
  @Column({ type: 'varchar', length: 255, name: 'previous_value', nullable: true })
  previous_value: string | null;

  @ApiProperty({ example: '25.00', nullable: true })
  @Column({ type: 'varchar', length: 255, name: 'new_value', nullable: true })
  new_value: string | null;

  @ApiProperty({ example: 7, nullable: true, description: 'Author of the amendment' })
  @Column({ type: 'int', name: 'changed_by_user_id', nullable: true })
  changed_by_user_id: number | null;

  @ApiProperty({ description: 'When the amendment was recorded' })
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;
}
